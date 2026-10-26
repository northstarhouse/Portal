// Public client page backend (#pay). A client's "venue code" is their event
// date (e.g. DEC 20 2026). Every action re-resolves the code to a booking, so a
// wrong code can never reach payment or upload. Payments are captured and
// verified server-side with PayPal before anything is recorded.
//
// Secrets: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV ("live" | "sandbox", default live)

const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PP_ID = Deno.env.get('PAYPAL_CLIENT_ID') || '', PP_SECRET = Deno.env.get('PAYPAL_SECRET') || '';
const PP_BASE = Deno.env.get('PAYPAL_ENV') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-app-token', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store' };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
class Fail extends Error { constructor(m: string, public status = 400, public extra: Record<string, unknown> = {}) { super(m); } }

const QUESTIONNAIRE_FORM_ID = 'e9be06b9-6788-41bc-a78a-28e02b8b749a';
const EMAIL_FIELD = 'nzic6lad';
const INQUIRY_SELECT = 'id,name,email,status,event_type,event_date,insurance_uploaded_at,questionnaire_form_response_id,brick_lines,venue_payment_schedule(id,sequence,label,amount_cents,amount_paid_cents,due_date,status)';

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

async function ppToken() {
  if (!PP_ID || !PP_SECRET) throw new Fail('Online payments are not available yet.', 503);
  const r = await fetch(PP_BASE + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(PP_ID + ':' + PP_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!r.ok) throw new Fail('Payment service is unavailable. Please try again shortly.', 502);
  return (await r.json()).access_token as string;
}

// ---------- Google Drive (same service account + Shared Drive as upload-receipt / upload-mail) ----------

// Portal Backend Shared Drive root; insurance lands in Admin / Venue Insurance.
const DRIVE_ROOT_FOLDER_ID = '1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx';
const b64url = (b: ArrayBuffer | Uint8Array) => { const a = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
let driveToken: { token: string; exp: number } | null = null;
let insuranceFolderId: string | null = null;

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

async function uploadInsuranceToDrive(filename: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const token = await driveAccessToken();
  if (!insuranceFolderId) insuranceFolderId = await driveFolder('Venue Insurance', await driveFolder('Admin', DRIVE_ROOT_FOLDER_ID, token), token);
  const boundary = 'nsh-' + crypto.randomUUID(), enc = new TextEncoder();
  const body = new Blob([enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename, parents: [insuranceFolderId] })}\r\n`), enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`), bytes, enc.encode(`\r\n--${boundary}--`)]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!r.ok) throw new Error('Drive upload failed: ' + r.status + ' ' + await r.text());
  return (await r.json()).webViewLink as string;
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

    if (action === 'lookup') return json({ ...view(date, inq), paypal_client_id: PP_ID || null });

    if (action === 'create_order') {
      const cents = Math.round(Number(body.amount_cents));
      if (!Number.isInteger(cents) || cents < 100 || cents > 2_000_000) throw new Fail('Enter an amount between $1.00 and $20,000.00.');
      const tok = await ppToken();
      const r = await fetch(PP_BASE + '/v2/checkout/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ custom_id: 'inq:' + inq.id, description: 'North Star House venue payment - ' + date, amount: { currency_code: 'USD', value: (cents / 100).toFixed(2) } }] }) });
      if (!r.ok) throw new Fail('Could not start the payment. Please try again.', 502);
      return json({ id: (await r.json()).id });
    }

    if (action === 'capture_order') {
      const orderId = String(body.order_id || '');
      if (!/^[A-Z0-9]{10,30}$/.test(orderId)) throw new Fail('Invalid payment.');
      const tok = await ppToken();
      const r = await fetch(PP_BASE + `/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: '{}' });
      const order = await r.json().catch(() => ({}));
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
      let url: string;
      try { url = await uploadInsuranceToDrive(filename, bin, type); }
      catch (e) { console.error('client-pay drive', e instanceof Error ? e.message : e); throw new Fail('The upload failed. Please try again.', 502); }
      await rest(`venue_inquiries?id=eq.${inq.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ insurance_uploaded_at: new Date().toISOString(), insurance_drive_url: url }) });
      return json({ uploaded: true });
    }

    // "Message our team": saved (server-only table) and emailed to the venue team.
    if (action === 'send_message') {
      const text = String(body.message || '').trim();
      const fromName = String(body.contact_name || '').trim().slice(0, 100);
      const fromEmail = String(body.contact_email || '').trim().slice(0, 200);
      if (!fromName) throw new Fail('Please enter your name.');
      if (!text) throw new Fail('Please type a message.');
      if (text.length > 2000) throw new Fail('Please keep your message under 2,000 characters.');
      if (fromEmail && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(fromEmail)) throw new Fail('That email address does not look right.');
      messageBrake(ip);
      const since = encodeURIComponent(new Date(Date.now() - 3600_000).toISOString());
      const recent = await rest(`venue_client_messages?select=id&inquiry_id=eq.${inq.id}&created_at=gte.${since}`);
      if (recent.length >= 10) throw new Fail('You have sent several messages recently. Please call or email us directly.', 429);
      await rest('venue_client_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ inquiry_id: inq.id, event_title: inq.name, from_name: fromName, from_email: fromEmail || null, body: text }) });
      // The saved message is the record, so an email hiccup doesn't lose it.
      try {
        const mail = await fetch(`${URL_}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
          body: JSON.stringify({
            to: 'venue@thenorthstarhouse.org',
            subject: `Message from ${inq.name} (${code})`,
            body: `${fromName} sent a message from the client event page.\n\nBooking: ${inq.name}\nEvent date: ${date}\nBooking email on file: ${inq.email || 'none'}\nReply goes to: ${fromEmail || inq.email || 'none on file'}\n\n${text}\n\nReply to this email to answer them. A copy is saved with the booking.`,
            sender: 'Event Page',
            replyTo: fromEmail || inq.email || undefined,
          }),
        });
        if (!mail.ok) console.error('client-pay message email failed', mail.status);
      } catch (e) { console.error('client-pay message email', e instanceof Error ? e.message : e); }
      return json({ sent: true });
    }

    // Wedding brick engraving: 3 lines, 20 characters max each (counting spaces and punctuation).
    if (action === 'brick_save') {
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
      const fields = (form.fields || []).filter((f: any) => f.id !== EMAIL_FIELD).map((f: any) => ({ id: f.id, type: f.type, label: f.label, required: !!f.required, options: f.options || [], section: f.section || '', placeholder: f.placeholder || '', note: f.note || '', image: f.image || '', imageAlt: f.imageAlt || '' }));
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
