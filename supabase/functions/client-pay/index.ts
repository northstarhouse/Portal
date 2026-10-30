// Public client page backend (#pay). A client's "venue code" is their event
// date (e.g. DEC 20 2026). Every action re-resolves the code to a booking, so a
// wrong code can never reach payment or upload. Payments are captured and
// verified server-side with PayPal before anything is recorded.
//
// PayPal: with PAYPAL_CLIENT_ID + PAYPAL_SECRET set here (PAYPAL_ENV "live" |
// "sandbox", default live) it calls PayPal directly. Without them it goes
// through the website's worker (/api/_internal/venue-paypal), which already
// holds the PayPal credentials; the key for that is the service-role-only
// private_config row 'venue_paypal_proxy_key'.

const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PP_ID = Deno.env.get('PAYPAL_CLIENT_ID') || '', PP_SECRET = Deno.env.get('PAYPAL_SECRET') || '';
const PP_BASE = Deno.env.get('PAYPAL_ENV') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-app-token', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store' };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
class Fail extends Error { constructor(m: string, public status = 400, public extra: Record<string, unknown> = {}) { super(m); } }

const QUESTIONNAIRE_FORM_ID = 'e9be06b9-6788-41bc-a78a-28e02b8b749a';
const EMAIL_FIELD = 'nzic6lad';
const INQUIRY_SELECT = 'id,name,email,status,event_type,event_date,created_at,prebooking_form_response_id,insurance_uploaded_at,questionnaire_form_response_id,brick_lines,venue_payment_schedule(id,sequence,label,amount_cents,amount_paid_cents,due_date,status)';
const TOUR_ADDRESS = '12075 Auburn Rd. Grass Valley, CA 95949';

const PAGE_URL = 'https://venue.northstarhouse.org/';
const TOUR_DIRECTIONS_TEXT = `When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house.

Apple Maps users: make sure your directions take you to Auburn Road, not Allison Ranch Road.

Enter through the courtyard to arrive at the front door of the estate. Your coordinator will meet you in this general area.`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

// Branded confirmation email (same look as the website's tour confirmation) with a button to the client page.
function walkthroughEmailHtml(when: string, guide: string) {
  const gold = '#886c44';
  return `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${gold};"></div><div style="padding:44px 40px 36px;text-align:center;">`
    + `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:${gold};font-weight:bold;margin-bottom:14px;">NORTH STAR HOUSE</div>`
    + `<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">Your Walk-Through Is Confirmed</h1><div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>`
    + `<p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">Your second walk-through of North Star House is booked.<br><br>Date &amp; Time: <strong>${esc(when)}</strong><br>${guide ? `Your guide: <strong>${esc(guide)}</strong><br>` : ''}Address: <strong>${esc(TOUR_ADDRESS)}</strong><br><br>${esc(TOUR_DIRECTIONS_TEXT).replace(/\n\n/g, '<br><br>')}</p>`
    + `<a href="${PAGE_URL}" style="display:inline-block;background:${gold};color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:16px 32px;">Go to Your Event Page</a>`
    + `<p style="margin:22px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email.</i></p></div></div></div>`;
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + path, { ...init, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...init.headers } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Database request failed.');
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

// Best-effort brake on code guessing (per function instance).
const misses = new Map<string, { n: number; t: number }>();
function brakeCheck(ip: string) {
  const m = misses.get(ip);
  if (m && Date.now() - m.t > 15 * 60_000) misses.delete(ip);
  if ((misses.get(ip)?.n || 0) >= 10) throw new Fail('Too many incorrect codes. Please wait 15 minutes and try again.', 429);
}
function brakeMiss(ip: string) {
  const cur = misses.get(ip) || { n: 0, t: Date.now() };
  misses.set(ip, { n: cur.n + 1, t: cur.t });
}

// At most 5 messages per 15 minutes from one address.
const sent = new Map<string, number[]>();
function messageBrake(ip: string) {
  const now = Date.now(), recent = (sent.get(ip) || []).filter(t => now - t < 15 * 60_000);
  if (recent.length >= 5) throw new Fail('You have sent several messages recently. Please try again in a little while, or call us.', 429);
  recent.push(now); sent.set(ip, recent);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Venue code = wedding date, written like DEC-28-2026. Also accepts "DEC 28 2026",
// "December 28, 2026", "12/28/2026" and "2026-12-28" -> "2026-12-28".
function parseCode(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  let y: number, m: number, d: number, x: RegExpMatchArray | null;
  if ((x = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else {
    const s = t.replace(/[,.\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
    if ((x = s.match(/^(\d{1,2}) (\d{1,2}) (\d{4})$/))) { m = +x[1]; d = +x[2]; y = +x[3]; }
    else if ((x = s.match(/^([A-Z]{3,9}) (\d{1,2})(?:ST|ND|RD|TH)? (\d{4})$/))) { m = MONTHS.indexOf(x[1].slice(0, 3)) + 1; d = +x[2]; y = +x[3]; if (!m) return null; }
    else return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

async function resolve(body: any, ip: string) {
  const date = parseCode(String(body.code || ''));
  const miss = () => { brakeMiss(ip); return new Fail("We couldn't find a booking for that venue code. Check the code in your email.", 404); };
  if (!date) throw miss();
  let rows = await rest(`venue_inquiries?select=${INQUIRY_SELECT}&event_date=eq.${date}&prebooking_form_response_id=not.is.null`);
  const nm = String(body.name || '').trim().toLowerCase();
  if (rows.length > 1 && nm) rows = rows.filter((r: any) => (r.name || '').toLowerCase().includes(nm));
  if (!rows.length) throw miss();
  if (rows.length > 1) throw new Fail('More than one booking uses this date. Please add your last name.', 409, { needs_name: true });
  return { date, inq: rows[0] };
}

function view(date: string, inq: any) {
  const sched = (inq.venue_payment_schedule || []).slice().sort((a: any, b: any) => a.sequence - b.sequence);
  const total = sched.reduce((s: number, r: any) => s + (r.amount_cents || 0), 0);
  const paid = sched.reduce((s: number, r: any) => s + (r.amount_paid_cents || 0), 0);
  const next = sched.find((r: any) => (r.amount_paid_cents || 0) < r.amount_cents);
  return {
    name: inq.name, event_type: inq.event_type, event_date: date,
    has_schedule: sched.length > 0, total_cents: total, paid_cents: paid, balance_cents: Math.max(0, total - paid),
    next_due: next ? { label: next.label, due_date: next.due_date, amount_cents: next.amount_cents - (next.amount_paid_cents || 0) } : null,
    insurance_uploaded: !!inq.insurance_uploaded_at,
    questionnaire_done: !!inq.questionnaire_form_response_id,
    brick_lines: Array.isArray(inq.brick_lines) ? inq.brick_lines : ['', '', ''],
    brick_done: Array.isArray(inq.brick_lines) && inq.brick_lines.some((l: string) => String(l).trim()),
  };
}

// The couple's second walk-through, if they've booked one (estate_tours row
// linked by venue_inquiry_id when booked from this page).
async function walkthroughFor(inq: any) {
  const rows = await rest(`estate_tours?select=date,start_time&venue_inquiry_id=eq.${inq.id}&status=eq.booked&order=date.desc,start_time.desc&limit=1`).catch(() => []);
  return rows?.[0] || null;
}

const SITE_PAYPAL = 'https://www.northstarhouse.org/api/_internal/venue-paypal';
let proxy: { key: string; clientId: string } | null = null;
async function ppProxy() {
  if (proxy) return proxy;
  const rows = await rest(`private_config?select=value&key=eq.venue_paypal_proxy_key`);
  const key = rows?.[0]?.value;
  if (!key) return null;
  const r = await fetch(SITE_PAYPAL, { method: 'POST', headers: { 'x-venue-pay-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'config' }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.client_id) return null;
  return (proxy = { key, clientId: d.client_id });
}
async function proxyCall(body: Record<string, unknown>) {
  const p = await ppProxy();
  if (!p) throw new Fail('Online payments are not available yet.', 503);
  const r = await fetch(SITE_PAYPAL, { method: 'POST', headers: { 'x-venue-pay-key': p.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}
async function ppClientId() {
  if (PP_ID && PP_SECRET) return PP_ID;
  return (await ppProxy().catch(() => null))?.clientId || null;
}
// What PayPal shows for the payment (transaction details, both sides):
// "Emily DeWolfe & Sebastian Leon Wedding - Oct 23, 2027 (OCT-23-2027) - North Star House venue payment".
// The trailing staff tag on booking names, like "(S)", is left off.
function ppLabel(inq: any, date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const when = MONTHS[m - 1].charAt(0) + MONTHS[m - 1].slice(1).toLowerCase() + ' ' + d + ', ' + y;
  const code = MONTHS[m - 1] + '-' + String(d).padStart(2, '0') + '-' + y;
  const name = String(inq.name || '').replace(/\s*\([A-Za-z]{1,3}\)\s*$/, '').trim().slice(0, 70);
  return [name || 'Venue booking', when + ' (' + code + ')', 'North Star House venue payment'].join(' - ').slice(0, 127);
}

async function ppCreate(inqId: string, date: string, cents: number, label: string) {
  if (!(PP_ID && PP_SECRET)) return proxyCall({ op: 'create', inquiry_id: inqId, date, amount_cents: cents, label });
  const tok = await ppToken();
  const r = await fetch(PP_BASE + '/v2/checkout/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ custom_id: 'inq:' + inqId, description: label, amount: { currency_code: 'USD', value: (cents / 100).toFixed(2) } }] }) });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}
async function ppCapture(orderId: string) {
  if (!(PP_ID && PP_SECRET)) return proxyCall({ op: 'capture', order_id: orderId });
  const tok = await ppToken();
  const r = await fetch(PP_BASE + `/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: '{}' });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

async function ppToken() {
  if (!PP_ID || !PP_SECRET) throw new Fail('Online payments are not available yet.', 503);
  const r = await fetch(PP_BASE + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(PP_ID + ':' + PP_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!r.ok) throw new Fail('Payment service is unavailable. Please try again shortly.', 502);
  return (await r.json()).access_token as string;
}

// ---------- Google Drive (same service account + Shared Drive as upload-receipt / upload-mail) ----------

// Portal Backend Shared Drive root; each client gets a folder in Admin / Venue Clients named
// "<event date> - <couple> - <event type>", and their insurance certificate lands inside it.
const DRIVE_ROOT_FOLDER_ID = '1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx';
const b64url = (b: ArrayBuffer | Uint8Array) => { const a = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
let driveToken: { token: string; exp: number } | null = null;

async function driveAccessToken(): Promise<string> {
  if (driveToken && driveToken.exp > Date.now() + 30_000) return driveToken.token;
  const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!);
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const input = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' + b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + input + '.' + b64url(sig) });
  if (!r.ok) throw new Error('Google token exchange failed: ' + r.status);
  const d = await r.json(); driveToken = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return driveToken.token;
}

async function driveFolder(name: string, parentId: string, token: string): Promise<string> {
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`, { headers: { Authorization: 'Bearer ' + token } });
  if (!list.ok) throw new Error('Drive folder lookup failed: ' + list.status);
  const found = await list.json(); if (found.files?.length) return found.files[0].id;
  const made = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }) });
  if (!made.ok) throw new Error('Drive folder create failed: ' + made.status);
  return (await made.json()).id;
}

// Returns the link to the client's folder (not the file), so staff land on everything for that event.
async function uploadInsuranceToDrive(folderName: string, filename: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const token = await driveAccessToken();
  const clientsFolder = await driveFolder('Venue Clients', await driveFolder('Admin', DRIVE_ROOT_FOLDER_ID, token), token);
  const insuranceFolderId = await driveFolder(folderName, clientsFolder, token);
  const boundary = 'nsh-' + crypto.randomUUID(), enc = new TextEncoder();
  const body = new Blob([enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename, parents: [insuranceFolderId] })}\r\n`), enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`), bytes, enc.encode(`\r\n--${boundary}--`)]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!r.ok) throw new Error('Drive upload failed: ' + r.status + ' ' + await r.text());
  await r.json();
  return `https://drive.google.com/drive/folders/${insuranceFolderId}`;
}

// Apply a payment to the unpaid schedule rows in order.
async function applyToSchedule(inq: any, cents: number) {
  let left = cents;
  const sched = (inq.venue_payment_schedule || []).slice().sort((a: any, b: any) => a.sequence - b.sequence);
  for (const r of sched) {
    if (left <= 0) break;
    const room = r.amount_cents - (r.amount_paid_cents || 0);
    if (room <= 0) continue;
    const add = Math.min(room, left); left -= add;
    const paid = (r.amount_paid_cents || 0) + add;
    await rest(`venue_payment_schedule?id=eq.${r.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ amount_paid_cents: paid, status: paid >= r.amount_cents ? 'paid' : r.status }) });
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  try {
    brakeCheck(ip);
    const body = await req.json(); const action = String(body.action || '');
    const { date, inq } = await resolve(body, ip);
    const code = String(body.code).trim();

    if (action === 'lookup') {
      const [paypal_client_id, walkthrough] = await Promise.all([ppClientId(), walkthroughFor(inq)]);
      return json({ ...view(date, inq), walkthrough, paypal_client_id });
    }

    if (action === 'create_order') {
      const cents = Math.round(Number(body.amount_cents));
      if (!Number.isInteger(cents) || cents < 100 || cents > 2_000_000) throw new Fail('Enter an amount between $1.00 and $20,000.00.');
      const r = await ppCreate(inq.id, date, cents, ppLabel(inq, date));
      if (!r.ok || !r.body.id) throw new Fail('Could not start the payment. Please try again.', 502);
      return json({ id: r.body.id });
    }

    if (action === 'capture_order') {
      const orderId = String(body.order_id || '');
      if (!/^[A-Z0-9]{10,30}$/.test(orderId)) throw new Fail('Invalid payment.');
      const r = await ppCapture(orderId);
      const order = r.body;
      const cap = order?.purchase_units?.[0]?.payments?.captures?.[0];
      if (!r.ok && order?.details?.[0]?.issue !== 'ORDER_ALREADY_CAPTURED') throw new Fail('The payment was not completed. You have not been charged.', 402);
      if (!cap) throw new Fail('We could not confirm the payment. Please contact us before paying again.', 502);
      // The order must have been created for THIS booking.
      if (order.purchase_units[0].custom_id !== 'inq:' + inq.id) throw new Fail('This payment does not match the venue code entered.', 409);
      if (cap.status !== 'COMPLETED') throw new Fail('Your payment is pending with PayPal. We will record it once it clears.', 202);
      const cents = Math.round(parseFloat(cap.amount.value) * 100);
      const exists = await rest(`venue_payments?select=id&paypal_capture_id=eq.${cap.id}`);
      if (!exists.length) {
        await rest('venue_payments', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ inquiry_id: inq.id, venue_code: code, amount_cents: cents, currency: cap.amount.currency_code, paypal_order_id: orderId, paypal_capture_id: cap.id, payer_name: [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(' ') || null, payer_email: order.payer?.email_address || null }) });
        await applyToSchedule(inq, cents);
      }
      const fresh = await rest(`venue_inquiries?select=${INQUIRY_SELECT}&id=eq.${inq.id}`);
      return json({ recorded: true, receipt_id: cap.id, paid_cents: cents, ...view(date, fresh[0]) });
    }

    if (action === 'upload_insurance') {
      const type = String(body.mime_type || ''), ext = ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as Record<string, string>)[type];
      if (!ext) throw new Fail('Please upload a PDF, JPG or PNG.');
      const bin = Uint8Array.from(atob(String(body.base64 || '')), c => c.charCodeAt(0));
      if (!bin.length || bin.length > 8 * 1024 * 1024) throw new Fail('The file must be under 8 MB.');
      const safeName = String(inq.name || 'Client').replace(/[^\w .+&-]/g, '').trim().slice(0, 80);
      const filename = `${date} - ${safeName} - Insurance.${ext}`;
      const kind = String(inq.event_type || 'Event').replace(/[^\w .+&-]/g, '').trim().slice(0, 40) || 'Event';
      const folderName = `${date} - ${safeName} - ${kind}`;
      let url: string;
      try { url = await uploadInsuranceToDrive(folderName, filename, bin, type); }
      catch (e) { console.error('client-pay drive', e instanceof Error ? e.message : e); throw new Fail('The upload failed. Please try again.', 502); }
      await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ insurance_uploaded_at: new Date().toISOString(), insurance_drive_url: url }) });
      return json({ uploaded: true });
    }

    // "Message our team": saved (server-only table) and emailed to the venue team.
    // The couple's rental agreement, shown on their event page. They sign through the same verified flow as the emailed link
    // (emailed six-digit code + venue code); the link minted here replaces any earlier link for that signer.
    if (action === 'agreement_status' || action === 'agreement_link') {
      const resp = inq.prebooking_form_response_id;
      const vs = await rest(`venue_agreement_versions?select=id,version,status,title,issued_at,completed_at&response_id=eq.${resp}&status=in.(pending,completed)&order=version.desc&limit=1`);
      const v = vs && vs[0];
      // Bookings made before this date are grandfathered: their agreement is already signed and on file.
      if (!v) return json({ agreement: String(inq.created_at || '9999').slice(0, 10) < '2026-10-30' ? { legacy: true, status: 'completed', signers: [] } : null });
      const signers = await rest(`venue_agreement_signers?select=id,name,role,status,signed_at&version_id=eq.${v.id}&order=role.asc,name.asc`);
      if (action === 'agreement_status') return json({ agreement: { ...v, signers } });
      const signer = signers.find((s: any) => s.id === String(body.signer_id || ''));
      if (!signer || signer.role !== 'client') throw new Fail('That signer was not found on this agreement.', 404);
      const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('agreement-link:' + KEY + ':' + value));
      const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
      await rest('rpc/venue_agreement_action', { method: 'POST', body: JSON.stringify({ p_action: 'link', p_data: { version_id: v.id, signer_id: signer.id, hash } }) });
      return json({ token: value });
    }

    // The people on this booking, taken from their pre-booking form (not typed in by whoever is on the page).
    async function bookingContacts() {
      const out: { name: string; email: string; phone: string }[] = [];
      try {
        const rows = await rest(`nsh_form_responses?select=answers&id=eq.${inq.prebooking_form_response_id}`);
        const a = (rows && rows[0] && rows[0].answers) || {};
        const nice = (n: string) => { const t = String(n || '').trim(); const m = t.match(/^([^,]+),\s*(.+)$/); return m ? `${m[2].trim()} ${m[1].trim()}` : t; };
        const add = (n: unknown, e: unknown, p: unknown) => { if (n && String(n).trim()) out.push({ name: nice(String(n)), email: String(e || '').trim(), phone: String(p || '').trim() }); };
        add(a['7fnabd0i'] || a.evp_name, a.c9u1sxb4 || a.evp_email, a['163otrai'] || a.evp_phone);
        add(a['7leui2ic'], a.pt4mail1, a.pt4phon1);
      } catch (_e) { /* fall back to the booking itself below */ }
      if (!out.length) out.push({ name: String(inq.name || 'Client'), email: String(inq.email || ''), phone: '' });
      return out;
    }

    if (action === 'message_contacts') {
      const list = await bookingContacts();
      return json({ contacts: list.map((c, i) => ({ id: i, name: c.name, email: c.email, phone: c.phone })) });
    }

    if (action === 'send_message') {
      const text = String(body.message || '').trim();
      const people = await bookingContacts();
      const who = people[Number(body.contact_id)] || people[0];
      const fromName = who.name, fromEmail = who.email, fromPhone = who.phone;
      const prefers = body.reply_via === 'phone' ? 'phone' : 'email';
      const replyLine = prefers === 'phone' ? `Prefers a phone call${fromPhone ? ': ' + fromPhone : ' (no phone number on file)'}` : `Prefers an email reply${fromEmail ? ': ' + fromEmail : ' (no email on file)'}`;
      if (!text) throw new Fail('Please type a message.');
      if (text.length > 2000) throw new Fail('Please keep your message under 2,000 characters.');
      messageBrake(ip);
      const since = encodeURIComponent(new Date(Date.now() - 3600_000).toISOString());
      const recent = await rest(`venue_client_messages?select=id&inquiry_id=eq.${inq.id}&created_at=gte.${since}`);
      if (recent.length >= 10) throw new Fail('You have sent several messages recently. Please call or email us directly.', 429);
      await rest('venue_client_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ inquiry_id: inq.id, event_title: inq.name, from_name: fromName, from_email: fromEmail || null, body: text }) });
      // Also saved to the Portal's Messages list (event_uid 'client:<pre-booking id>' marks it as from a couple's event page),
      // so it shows in Needs your attention until it is marked handled.
      try {
        await rest('venue_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ event_uid: 'client:' + inq.prebooking_form_response_id, event_title: inq.name, subject: 'Message from the event page · ' + (prefers === 'phone' ? 'wants a call' : 'wants an email'), body: text + '\n\n' + replyLine, from_name: fromName, from_email: fromEmail || null, direction: 'incoming' }) });
      } catch (e) { console.error('client-pay venue_messages', e instanceof Error ? e.message : e); }
      // The saved message is the record, so an email hiccup doesn't lose it.
      try {
        const mail = await fetch(`${URL_}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
          body: JSON.stringify({
            to: 'venue@thenorthstarhouse.org',
            subject: `Message from ${fromName} · ${inq.name} (${code})`,
            body: `${fromName} sent a message from their client event page.\n\n${replyLine}\n\nBooking: ${inq.name}\nEvent date: ${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}\n\n${text}\n\nReply to this email to answer them. A copy is saved with the booking.`,
            sender: 'Event Page',
            replyTo: fromEmail || inq.email || undefined,
          }),
        });
        if (!mail.ok) console.error('client-pay message email failed', mail.status);
      } catch (e) { console.error('client-pay message email', e instanceof Error ? e.message : e); }
      return json({ sent: true });
    }

    // Second walk-through: the same open tour times the website offers.
    if (action === 'tour_slots') {
      const today = new Date().toISOString().slice(0, 10);
      const slots = await rest(`estate_tours?select=id,date,start_time&status=eq.open&date=gte.${today}&order=date.asc,start_time.asc&limit=200`);
      return json({ slots });
    }
    if (action === 'tour_book') {
      const slotId = String(body.slot_id || '');
      if (!/^[0-9a-f-]{8,40}$/i.test(slotId) && !/^\d+$/.test(slotId)) throw new Fail('Please pick a time.');
      const phone = String(body.phone || '').trim().slice(0, 40);
      messageBrake(ip);
      const claim = await rest(`estate_tours?id=eq.${encodeURIComponent(slotId)}&status=eq.open`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'booked', visitor_name: inq.name, visitor_email: inq.email || null, visitor_phone: phone || null, category: 'Wedding second walk-through', venue_inquiry_id: inq.id }) });
      const row = claim?.[0];
      if (!row) throw new Fail('That time was just taken. Please pick another.', 409);
      const d = new Date(`${row.date}T${row.start_time}`);
      const when = `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      const guide = row.guide_name && String(row.guide_name).toLowerCase() !== 'default' ? row.guide_name : ([1, 2, 4].includes(new Date(`${row.date}T12:00:00`).getDay()) ? 'Jen' : '');
      try {
        await fetch(`${URL_}/functions/v1/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify({ to: 'venue@thenorthstarhouse.org', subject: `Second walk-through booked: ${inq.name} (${code})`, body: `${inq.name} booked a second walk-through from the client event page.\n\n${when}\nPhone: ${phone || 'not given'}\nEmail: ${inq.email || 'none on file'}`, sender: 'Event Page' }) });
        if (inq.email) await fetch(`${URL_}/functions/v1/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify({ to: inq.email, subject: `Your North Star House walk-through is confirmed - ${when}`, body: `Hi,\n\nYour second walk-through is booked.\n\nDate & Time: ${when}\n${guide ? `Your guide: ${guide}\n` : ''}Address: ${TOUR_ADDRESS}\n\n${TOUR_DIRECTIONS_TEXT}\n\nGo to your event page: ${PAGE_URL}\n\nNorth Star House`, html: walkthroughEmailHtml(when, guide), sender: 'Estate Tours', fromEmail: 'venue@northstarhouse.org', replyTo: 'venue@thenorthstarhouse.org' }) });
      } catch (e) { console.error('client-pay tour email', e instanceof Error ? e.message : e); }
      return json({ booked: true, when, walkthrough: { date: row.date, start_time: row.start_time } });
    }

    // Wedding brick engraving: 3 lines, 20 characters max each (counting spaces and punctuation).
    if (action === 'brick_save') {
      if (Array.isArray(inq.brick_lines) && inq.brick_lines.some((l: string) => String(l).trim())) throw new Fail('Your brick wording has been submitted and can no longer be changed here. Please contact the venue if something needs to change.', 409);
      const given = Array.isArray(body.lines) ? body.lines : [];
      const lines = [0, 1, 2].map(i => String(given[i] ?? '').replace(/\s+/g, ' ').trim());
      if (lines.some(l => [...l].length > 20)) throw new Fail('Each line can be up to 20 characters, including spaces and punctuation.');
      if (lines.some(l => /[\u0000-\u001F\u007F]/.test(l))) throw new Fail('Please use letters, numbers and punctuation only.');
      if (!lines.some(Boolean)) throw new Fail('Enter at least one line to engrave.');
      await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ brick_lines: lines, brick_submitted_at: new Date().toISOString() }) });
      return json({ saved: true, brick_lines: lines, brick_done: true });
    }

    if (action === 'questionnaire_get') {
      const form = (await rest(`nsh_forms?select=fields&id=eq.${QUESTIONNAIRE_FORM_ID}`))[0];
      if (!form) throw new Fail('The questionnaire is unavailable right now.', 503);
      const fields = (form.fields || []).filter((f: any) => f.id !== EMAIL_FIELD).map((f: any) => ({ id: f.id, type: f.type, label: f.label, required: !!f.required, options: f.options || [], section: f.section || '', display: f.display || '', placeholder: f.placeholder || '', note: f.note || '', image: f.image || '', imageAlt: f.imageAlt || '' }));
      const prev = inq.questionnaire_form_response_id ? (await rest(`nsh_form_responses?select=answers&id=eq.${inq.questionnaire_form_response_id}`))[0] : null;
      return json({ fields, answers: prev?.answers || {}, submitted: !!prev });
    }

    if (action === 'questionnaire_save') {
      const form = (await rest(`nsh_forms?select=fields&id=eq.${QUESTIONNAIRE_FORM_ID}`))[0];
      if (!form) throw new Fail('The questionnaire is unavailable right now.', 503);
      const given = body.answers && typeof body.answers === 'object' ? body.answers : {};
      const clean: Record<string, unknown> = { [EMAIL_FIELD]: inq.email };
      for (const f of form.fields || []) {
        if (f.id === EMAIL_FIELD) continue;
        const v = given[f.id];
        const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
        if (empty) { if (f.required) throw new Fail('Please answer: ' + String(f.label).slice(0, 90), 400); continue; }
        if (f.type === 'checkboxes') clean[f.id] = (Array.isArray(v) ? v : []).map(String).filter((o: string) => (f.options || []).includes(o));
        else if (f.type === 'multiple_choice') { if (!(f.options || []).includes(String(v))) throw new Fail('Please choose a valid option.', 400); clean[f.id] = String(v); }
        else clean[f.id] = String(v).slice(0, 4000);
      }
      let rid = inq.questionnaire_form_response_id as string | null;
      if (rid) await rest(`nsh_form_responses?id=eq.${rid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ answers: clean }) });
      else rid = (await rest('nsh_form_responses', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ form_id: QUESTIONNAIRE_FORM_ID, answers: clean }) }))[0].id;
      await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ questionnaire_answers: clean, questionnaire_form_response_id: rid, ...(['Booked', 'Questionnaire Sent'].includes(inq.status) ? { status: 'Questionnaire Completed' } : {}) }) });
      return json({ saved: true });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message, ...e.extra }, e.status);
    console.error('client-pay', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
