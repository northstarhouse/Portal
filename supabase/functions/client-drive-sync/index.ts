// Files each venue client's paperwork into Google Drive:
//   <Closing Events Paperwork>/<event year>/<event date - client name>/
//     Pre-Booking Form, Pre-Event Questionnaire, Post-Event Feedback Form (Google Docs),
//     Insurance (copied from the client's insurance upload), Signed Contract (PDF).
// `sync` is safe to run any number of times: it only adds what is missing (the questionnaire is refreshed if the client changed it).
// It is called by database triggers whenever one of those things is submitted, and can be run for every client with `backfill`.
import { contractPdf } from "./contract-pdf.ts";
import { formPdf, type FormItem } from "./form-pdf.ts";
import { invoicePdf, type InvoiceData, type InvoiceLine, type InvoicePayment } from "./invoice-pdf.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
const ROOT_FOLDER_ID = "1sPNpV0TQlwThYxjq4EDxvTGmmWgTJvYa";

const WEDDING_PREBOOKING = "a3a383f7-e1db-4344-9dec-ea879ad3406d";
const EVENT_PREBOOKING = "668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8";
const QUESTIONNAIRE_FORM = "e9be06b9-6788-41bc-a78a-28e02b8b749a";
const QUESTIONNAIRE_EMAIL_FIELD = "nzic6lad";
const FEEDBACK_FORM = "5ebe4961-d50e-47f1-9071-e81c2ada6233";
const FEEDBACK_EMAIL_FIELD = "w2yhaoaf";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-token",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...CORS } });

// ---------- Supabase ----------
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Database ${path.split("?")[0]} failed: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ---------- Google Drive ----------
function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToBuf(pem: string) {
  const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, ""));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}
let cached: { token: string; exp: number } | null = null;
async function driveToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey("pkcs8", pemToBuf(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${claims}.${b64url(sig)}`,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const d = await res.json();
  cached = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return cached.token;
}
const D = "https://www.googleapis.com/drive/v3/files";
async function gjson(url: string, init: RequestInit = {}) {
  const token = await driveToken();
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
async function listChildren(folderId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const j = await gjson(`${D}?q=${encodeURIComponent(q)}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=200&fields=files(id,name,mimeType)`);
  return j.files || [];
}
async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const q = `name='${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const found = await gjson(`${D}?q=${encodeURIComponent(q)}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`);
  if (found.files?.length) return found.files[0].id;
  const made = await gjson(`${D}?supportsAllDrives=true`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  return made.id;
}
async function uploadFile(name: string, parentId: string, mimeType: string, bytes: Uint8Array, asDoc = false) {
  const boundary = `nsh-${crypto.randomUUID()}`;
  const enc = new TextEncoder();
  const meta: Record<string, unknown> = { name, parents: [parentId] };
  if (asDoc) meta.mimeType = "application/vnd.google-apps.document";
  const body = new Blob([
    enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`),
    enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`), bytes, enc.encode(`\r\n--${boundary}--`),
  ]);
  return gjson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id", {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
}
async function replaceFileContent(fileId: string, mimeType: string, bytes: Uint8Array) {
  await gjson(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true&fields=id`, {
    method: "PATCH", headers: { "Content-Type": mimeType }, body: bytes,
  });
}
async function trashFile(fileId: string) {
  await gjson(`${D}/${fileId}?supportsAllDrives=true&fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
}

// ---------- Rendering a form response as a readable document ----------
const esc = (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function show(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(show).filter(Boolean).join(", ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([, x]) => show(x)).filter(Boolean).join(", ");
  return String(v);
}
function buildItems(fields: any[], answers: Record<string, any>): FormItem[] {
  const items: FormItem[] = [];
  for (const f of fields || []) {
    if (f.type === "heading") { items.push({ kind: "heading", text: String(f.label || "") }); continue; }
    if (f.type === "divider") continue;
    if (f.type === "group") {
      const v = answers[f.id] || {};
      const parts = (f.parts || []).map((p: any) => `${p.label}: ${show(v[p.id])}`).filter((x: string) => !x.endsWith(": "));
      if (parts.length) items.push({ kind: "qa", label: String(f.label || ""), text: parts.join("\n") });
      continue;
    }
    const text = show(answers[f.id]);
    const note = answers[f.id + "__note"];
    if (!text && !note) continue;
    items.push({ kind: "qa", label: String(f.label || f.id), text, note: note ? String(note) : undefined });
  }
  return items;
}

// ---------- The client ----------
const clean = (t: string) => t.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 90);
const writtenDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const tidyBody = (t: string) => String(t || "").replace(/\[VENUE SIGNER\s*[—-]\s*TO COMPLETE\]/g, "Venue countersigner").replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => writtenDate(d));

async function resolvePrebookingId(responseId: string): Promise<string | null> {
  const r = (await rest(`nsh_form_responses?select=id,form_id,answers&id=eq.${responseId}`))?.[0];
  if (!r) return null;
  if (r.form_id === WEDDING_PREBOOKING || r.form_id === EVENT_PREBOOKING) return r.id;
  const linked = (await rest(`venue_inquiries?select=prebooking_form_response_id&or=(questionnaire_form_response_id.eq.${r.id},feedback_form_response_id.eq.${r.id},prebooking_form_response_id.eq.${r.id})&limit=1`))?.[0];
  if (linked?.prebooking_form_response_id) return linked.prebooking_form_response_id;
  const emailField = r.form_id === QUESTIONNAIRE_FORM ? QUESTIONNAIRE_EMAIL_FIELD : r.form_id === FEEDBACK_FORM ? FEEDBACK_EMAIL_FIELD : null;
  const email = emailField ? String(r.answers?.[emailField] || "").trim().toLowerCase() : "";
  if (!email) return null;
  const pbs = await rest(`nsh_form_responses?select=id,answers&form_id=in.(${WEDDING_PREBOOKING},${EVENT_PREBOOKING})&order=created_at.desc&limit=500`);
  const hit = (pbs || []).find((p: any) => [p.answers?.c9u1sxb4, p.answers?.evp_email, p.answers?.pt4mail1, p.answers?.["ps4mail1"]].some((e: any) => String(e || "").trim().toLowerCase() === email));
  return hit ? hit.id : null;
}

// The client's Drive folder: "<event date> - <client name>" under its year, made on first use.
async function clientFolder(pbId: string, a: Record<string, any>, inq: any) {
  const two = a["7fnabd0i"] && a["7leui2ic"] ? `${a["7fnabd0i"]} + ${a["7leui2ic"]}` : a["7fnabd0i"];
  const name = clean(String(a.__event_name || inq?.name || a.evp_org || two || a.evp_name || "Client")).replace(/(?<!&)\s+Wedding$/i, "") || "Client";
  const date = String(inq?.event_date || a.sn9urgfr || a.evp_date || "").slice(0, 10);
  const year = /^\d{4}/.test(date) && date.slice(0, 4) >= "2000" ? date.slice(0, 4) : "Undated";
  const folderName = `${/^\d{4}-\d{2}-\d{2}$/.test(date) && year !== "Undated" ? date : "Undated"} - ${name}`;

  // the client's folder (remembered, so a later name or date change does not start a second folder)
  let rec = (await rest(`venue_drive_folders?select=*&response_id=eq.${pbId}`))?.[0];
  if (!rec) {
    const yearId = await findOrCreateFolder(year, ROOT_FOLDER_ID);
    const folderId = await findOrCreateFolder(folderName, yearId);
    rec = { response_id: pbId, folder_id: folderId, folder_url: `https://drive.google.com/drive/folders/${folderId}` };
    await rest("venue_drive_folders?on_conflict=response_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ ...rec, folder_name: folderName }) });
  }
  const folderId = rec.folder_id as string;
  // keep the folder's name in step with the client's name and event date
  if (rec.folder_name && rec.folder_name !== folderName) {
    try {
      await gjson(`${D}/${folderId}?supportsAllDrives=true&fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: folderName }) });
      await rest(`venue_drive_folders?response_id=eq.${pbId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ folder_name: folderName }) });
    } catch (_e) { /* keep the old name */ }
  }
  return { folderId, folderUrl: rec.folder_url as string, folderName, name, date };
}

// The invoice for a client: the HoneyBook invoice's items and schedule when there is one (the latest invoice file),
// otherwise the Portal's own payment schedule. Payments logged by hand are applied to the unpaid scheduled payments in date order.
async function invoiceData(pb: any, inq: any, name: string, date: string): Promise<InvoiceData | null> {
  const a = pb.answers || {}, hb = a.__honeybook;
  const stripHtml = (h: unknown) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const files: any[] = hb?.files || [];
  const stamp = (id: string) => files.find((x) => x.id === id)?.updated_at || "";
  const invoice = (hb?.file_responses || []).filter((r: any) => r.responses?.payments && typeof r.responses.payments === "object").sort((x: any, y: any) => String(stamp(y.id)).localeCompare(String(stamp(x.id))))[0];
  const P = invoice?.responses?.payments;
  const lines: InvoiceLine[] = [];
  let schedule: InvoicePayment[] = [];
  let total = 0, paidAmt = 0;
  let issued = String(pb.created_at || "").slice(0, 10);
  const extras = (Array.isArray(a.__venue_checklist?.extra_charges) ? a.__venue_checklist.extra_charges : []).filter((c: any) => c?.cents > 0);
  if (P) {
    issued = String(stamp(invoice.id) || issued).slice(0, 10);
    const add = (li: any, child: boolean) => {
      const qty = li.quantity == null ? 1 : li.quantity, unit = li.price?.amount || 0;
      if (!(unit > 0) && !(qty > 0)) return;
      lines.push({ item: li.title || "Item", desc: stripHtml(li.description), qty, unit, amount: unit * qty, child, deposit: /security deposit/i.test(li.title || "") });
    };
    for (const li of P.line_items || []) { add(li, false); for (const k of li.children || []) add(k, true); }
    if (P.discount?.amount > 0) lines.push({ item: "Discount", desc: "", qty: 1, unit: -P.discount.amount, amount: -P.discount.amount });
    if (P.tax?.amount > 0) lines.push({ item: "Tax", desc: "", qty: 1, unit: P.tax.amount, amount: P.tax.amount });
    const raw: any[] = P.schedule || [];
    schedule = raw.map((p, i) => {
      const cents = p.amount?.amount || 0;
      const dep = /security deposit/i.test(p.__nativeLabel || "") || (!p.__nativeLabel && raw.length > 1 && i === raw.length - 1 && cents === 80000);
      return { label: p.__nativeLabel || (dep ? "Refundable Security Deposit" : i === 0 ? "Booking payment" : "Scheduled payment " + (i + 1)), due: p.due_date ? String(p.due_date).slice(0, 10) : null, cents, paid: !!p.paid, paidAt: p.paid_at || null, deposit: dep };
    });
    // charges added after the HoneyBook invoice (e.g. a rehearsal added from the client page)
    const itemTotal = lines.reduce((t, l) => t + l.amount, 0);
    total = lines.length ? itemTotal : (P.total?.amount || 0);
    if (P.total?.amount != null) total = P.total.amount;
    paidAmt = P.amount_paid?.amount || 0;
  } else if (inq?.id) {
    const rows = await rest("venue_payment_schedule?select=sequence,kind,label,amount_cents,amount_paid_cents,due_date,status&inquiry_id=eq." + inq.id + "&order=sequence.asc");
    if (!Array.isArray(rows) || !rows.length) return null;
    for (const r of rows) {
      const dep = /security/i.test(String(r.kind || "") + " " + String(r.label || ""));
      lines.push({ item: r.label || "Payment", desc: "", qty: 1, unit: r.amount_cents || 0, amount: r.amount_cents || 0, deposit: dep });
      schedule.push({ label: r.label || "Payment", due: r.due_date ? String(r.due_date).slice(0, 10) : null, cents: r.amount_cents || 0, paid: r.status === "paid", deposit: dep });
    }
    total = rows.reduce((t: number, r: any) => t + (r.amount_cents || 0), 0);
    paidAmt = rows.reduce((t: number, r: any) => t + (r.amount_paid_cents || 0), 0);
  } else return null;
  // hand-logged payments settle the unpaid scheduled payments in date order
  const manual = (Array.isArray(a.__venue_checklist?.manual_payments) ? a.__venue_checklist.manual_payments : []).filter((m: any) => m?.cents > 0);
  let left = manual.reduce((t: number, m: any) => t + m.cents, 0);
  paidAmt += left;
  schedule = schedule.sort((x, y) => (x.deposit ? 1 : 0) - (y.deposit ? 1 : 0) || String(x.due || "9999").localeCompare(String(y.due || "9999")));
  for (const p of schedule) if (!p.paid && p.cents > 0 && left >= p.cents) { left -= p.cents; p.paid = true; }
  const people: { name: string; email?: string; phone?: string }[] = [];
  for (const c of (hb?.contacts || []).filter((c: any) => c.kind === "client")) {
    if (c.full_name && !people.some((p) => p.name.toLowerCase() === String(c.full_name).trim().toLowerCase())) people.push({ name: String(c.full_name).trim(), email: c.email || "", phone: c.phone_number || "" });
  }
  if (!people.length) {
    for (const [n, e, ph] of [[a["7fnabd0i"], a.c9u1sxb4, a["163otrai"]], [a.evp_name, a.evp_email, a.evp_phone]]) if (n) { people.push({ name: String(n).trim(), email: String(e || ""), phone: String(ph || "") }); break; }
  }
  const evType = a.__event_type ? String(a.__event_type) : /wedding/i.test(String(hb?.project?.name || inq?.event_type || "")) ? "Wedding" : "Private Event";
  // the client's venue code is the event date, like NOV-14-2026
  const dm = String(date || "").match(/^(d{4})-(d{2})-(d{2})/);
  const code = dm ? ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][+dm[2] - 1] + "-" + dm[3] + "-" + dm[1] : String(pb.id).slice(0, 6).toUpperCase();
  return { number: code, issued, eventName: name, eventDate: date || null, eventType: evType, clients: people, lines, total, paid: paidAmt, balance: Math.max(0, total - paidAmt), payments: schedule };
}

// A client's Drive folder is only made once they have paid something: an online payment, a payment logged by hand,
// or (for HoneyBook bookings) money already collected on the invoice.
async function hasPayment(pb: any, inq: any): Promise<boolean> {
  const a = pb.answers || {};
  const manual = (Array.isArray(a.__venue_checklist?.manual_payments) ? a.__venue_checklist.manual_payments : []).some((m: any) => m?.cents > 0);
  if (manual) return true;
  for (const r of a.__honeybook?.file_responses || []) { const p = r?.responses?.payments; if (p && typeof p === "object" && p.amount_paid?.amount > 0) return true; }
  if (inq?.id) {
    const rows = await rest("venue_payment_schedule?select=amount_paid_cents,status&inquiry_id=eq." + inq.id);
    if (Array.isArray(rows) && rows.some((r: any) => r.amount_paid_cents > 0 || r.status === "paid")) return true;
  }
  return false;
}

async function syncClient(pbId: string) {
  const pb = (await rest(`nsh_form_responses?select=id,form_id,answers,created_at&id=eq.${pbId}`))?.[0];
  if (!pb) return { skipped: "no such response" };
  const a = pb.answers || {};
  if (Object.values(a).some((v) => typeof v === "string" && /\+test@thenorthstarhouse\.org/i.test(v))) return { skipped: "test booking" };
  const inq = (await rest(`venue_inquiries?select=*&prebooking_form_response_id=eq.${pbId}&limit=1`))?.[0] || null;
  if (!(await hasPayment(pb, inq))) return { skipped: "no payment yet, so no Drive folder" };
  const { folderId, folderUrl, folderName, name, date } = await clientFolder(pbId, a, inq);
  const have = await listChildren(folderId);
  const has = (prefix: string) => have.find((f) => f.name.toLowerCase().startsWith(prefix.toLowerCase()));
  const done: string[] = [];

  const formDoc = async (label: string, formId: string, answers: Record<string, any> | null, when: string | null, refresh = false) => {
    if (!answers || !Object.keys(answers).length) return;
    // already filed and not one that is refreshed: skip the (memory-heavy) PDF build
    if (!refresh && have.some((f) => f.name.toLowerCase() === (label + ".pdf").toLowerCase())) return;
    const form = (await rest(`nsh_forms?select=title,fields&id=eq.${formId}`))?.[0];
    const pdfBytes = await formPdf(`${label} - ${name}`, `${form?.title || label}${when ? " - submitted " + String(when).slice(0, 10) : ""}${date ? " - event " + writtenDate(date) : ""}`, buildItems(form?.fields || [], answers));
    const fileName = `${label}.pdf`;
    // an earlier version of this filing saved Google Docs: swap those for the PDF
    for (const old of have.filter((f) => f.mimeType === "application/vnd.google-apps.document" && f.name.toLowerCase().startsWith(label.toLowerCase()))) {
      try { await trashFile(old.id); } catch (_e) { /* leave it if it cannot be removed */ }
    }
    const existing = have.find((f) => f.name.toLowerCase() === fileName.toLowerCase());
    if (!existing) { await uploadFile(fileName, folderId, "application/pdf", pdfBytes); done.push(fileName); }
    else if (refresh) { try { await replaceFileContent(existing.id, "application/pdf", pdfBytes); done.push(fileName + " (updated)"); } catch (_e) { /* keep the existing copy */ } }
  };

  // 1. pre-booking form
  await formDoc("Pre-Booking Form", pb.form_id, a, pb.created_at);

  // 2. pre-event questionnaire
  let qAnswers: Record<string, any> | null = inq?.questionnaire_answers || null, qWhen: string | null = null;
  if (inq?.questionnaire_form_response_id) {
    const q = (await rest(`nsh_form_responses?select=answers,created_at&id=eq.${inq.questionnaire_form_response_id}`))?.[0];
    if (q) { qAnswers = q.answers || qAnswers; qWhen = q.created_at; }
  }
  const emails = [a.c9u1sxb4, a.evp_email, a.pt4mail1].map((e: any) => String(e || "").trim()).filter((e) => e.includes("@"));
  const byEmail = async (formId: string, field: string) => {
    for (const e of emails) {
      const rows = await rest(`nsh_form_responses?select=answers,created_at&form_id=eq.${formId}&answers->>${field}=ilike.${encodeURIComponent(e)}&order=created_at.desc&limit=1`);
      if (rows?.[0]) return rows[0];
    }
    return null;
  };
  if (!qAnswers) { const q = await byEmail(QUESTIONNAIRE_FORM, QUESTIONNAIRE_EMAIL_FIELD); if (q) { qAnswers = q.answers; qWhen = q.created_at; } }
  await formDoc("Pre-Event Questionnaire", QUESTIONNAIRE_FORM, qAnswers, qWhen, true);

  // 2b. clients brought over from HoneyBook answered their questionnaire there: file those answers as the pre-event questionnaire
  if (!qAnswers && !has("Pre-Event Questionnaire")) {
    try {
      const plain = (h: unknown) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      const hbq = (a.__honeybook?.file_responses || []).find((r: any) => /(?:wedding|event) info questionnaire/i.test(r?.title || "") && (r?.responses?.questionnaire?.questions || []).some((q: any) => q.answered));
      if (hbq) {
        const items: FormItem[] = (hbq.responses.questionnaire.questions as any[]).filter((q) => q.answered || (q.answer != null && String(q.answer).trim())).map((q) => ({
          kind: "qa", label: plain(q.question), text: Array.isArray(q.answer) ? q.answer.map(String).join(", ") : typeof q.answer === "object" && q.answer ? JSON.stringify(q.answer) : String(q.answer ?? ""),
        }) as FormItem);
        if (items.length) {
          await uploadFile("Pre-Event Questionnaire.pdf", folderId, "application/pdf", await formPdf("Pre-Event Questionnaire - " + name, "Completed in HoneyBook" + (date ? " - event " + writtenDate(date) : ""), items));
          done.push("Pre-Event Questionnaire (from HoneyBook)");
        }
      }
    } catch (e: any) { done.push("Questionnaire failed: " + (e?.message || e)); }
  }

  // 3. post-event feedback form
  let fb: any = null;
  if (inq?.feedback_form_response_id) fb = (await rest(`nsh_form_responses?select=answers,created_at&id=eq.${inq.feedback_form_response_id}`))?.[0];
  if (!fb) fb = await byEmail(FEEDBACK_FORM, FEEDBACK_EMAIL_FIELD);
  if (fb) await formDoc("Post-Event Feedback Form", FEEDBACK_FORM, fb.answers, fb.created_at);

  // 4. insurance: copy whatever the client uploaded (it is kept in the venue's other Drive folder)
  if (!has("Insurance") && inq?.insurance_drive_url) {
    const oldId = String(inq.insurance_drive_url).split("/").pop()!.split("?")[0];
    const files = (await listChildren(oldId)).filter((f) => f.mimeType !== "application/vnd.google-apps.folder");
    for (const f of files) {
      await gjson(`${D}/${f.id}/copy?supportsAllDrives=true&fields=id`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: /insurance/i.test(f.name) ? f.name : `Insurance - ${f.name}`, parents: [folderId] }),
      });
      done.push("Insurance");
    }
  }

  // 5. signed contract
  {
    const ver = (await rest(`venue_agreement_versions?select=id,version&response_id=eq.${pbId}&status=eq.completed&order=version.desc&limit=1`))?.[0];
    const existingContract = has("Signed Contract");
    // a signed contract never changes, so it is written once; copies made with the first (plain) layout were named "Signed Contract (v1).pdf" and are replaced
    if (ver && (!existingContract || existingContract.name !== "Signed Contract.pdf")) {
      const rec2 = await rest("rpc/venue_agreement_record", { method: "POST", body: JSON.stringify({ p_id: ver.id }) });
      if (rec2) {
        const pdf = await contractPdf({ ...rec2, body: tidyBody(rec2.body) });
        const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
        if (existingContract) {
          await replaceFileContent(existingContract.id, "application/pdf", bytes);
          await gjson(`${D}/${existingContract.id}?supportsAllDrives=true&fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Signed Contract.pdf" }) });
        } else await uploadFile("Signed Contract.pdf", folderId, "application/pdf", bytes);
        done.push("Signed Contract");
      }
    }
  }

  // 6. invoice: the branded invoice as it was agreed (items, prices, payment schedule). Written once, never refreshed, so it does not change as payments come in.
  try {
    let inv: InvoiceData | null = null;
    if (!has("Invoice") && (inv = await invoiceData(pb, inq, name, date)) && (inv.lines.length || inv.payments.length)) {
      const bytes = await invoicePdf(inv);
      await uploadFile("Invoice.pdf", folderId, "application/pdf", bytes);
      done.push("Invoice");
    }
  } catch (e: any) { done.push("Invoice failed: " + (e?.message || e)); }

  // 7. brick wording the client chose (3 lines). It cannot be changed once submitted, so it is written once.
  try {
    const brick: string[] = Array.isArray(inq?.brick_lines) ? inq.brick_lines.map((l: any) => String(l || "").trim()) : [];
    if (brick.some((l) => l) && !has("Brick Wording")) {
      const bytes = await formPdf("Brick Wording - " + name, "Wedding brick engraving" + (inq.brick_submitted_at ? " - submitted " + String(inq.brick_submitted_at).slice(0, 10) : "") + (date ? " - event " + writtenDate(date) : ""),
        brick.map((l, i) => ({ kind: "qa", label: "Line " + (i + 1), text: l || "(blank)" }) as FormItem));
      await uploadFile("Brick Wording.pdf", folderId, "application/pdf", bytes);
      done.push("Brick Wording");
    }
  } catch (e: any) { done.push("Brick wording failed: " + (e?.message || e)); }

  return { folder: folderName, url: folderUrl, added: done };
}

// Just the signed contract copy (same rules as step 5 of the full sync), for a client whose full sync is too heavy to finish in one run.
async function contractOnly(pbId: string) {
  const pb = (await rest("nsh_form_responses?select=id,form_id,answers,created_at&id=eq." + pbId))?.[0];
  if (!pb) return { skipped: "no such response" };
  const inq = (await rest("venue_inquiries?select=*&prebooking_form_response_id=eq." + pbId + "&limit=1"))?.[0] || null;
  if (!(await hasPayment(pb, inq))) return { skipped: "no payment yet, so no Drive folder" };
  const { folderId, folderName } = await clientFolder(pbId, pb.answers || {}, inq);
  const have = await listChildren(folderId);
  const ver = (await rest("venue_agreement_versions?select=id,version&response_id=eq." + pbId + "&status=eq.completed&order=version.desc&limit=1"))?.[0];
  const existing = have.find((x) => x.name.toLowerCase().startsWith("signed contract"));
  if (!ver) return { folder: folderName, skipped: "no signed agreement" };
  if (existing && existing.name === "Signed Contract.pdf") return { folder: folderName, skipped: "contract already filed" };
  const rec2 = await rest("rpc/venue_agreement_record", { method: "POST", body: JSON.stringify({ p_id: ver.id }) });
  if (!rec2) return { folder: folderName, skipped: "no agreement record" };
  const pdf = await contractPdf({ ...rec2, body: tidyBody(rec2.body) });
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  if (existing) {
    await replaceFileContent(existing.id, "application/pdf", bytes);
    await gjson(D + "/" + existing.id + "?supportsAllDrives=true&fields=id", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Signed Contract.pdf" }) });
  } else await uploadFile("Signed Contract.pdf", folderId, "application/pdf", bytes);
  return { folder: folderName, added: ["Signed Contract"] };
}

// Just the invoice, for a client whose full sync is too heavy to finish in one run.
async function invoiceOnly(pbId: string) {
  const pb = (await rest("nsh_form_responses?select=id,form_id,answers,created_at&id=eq." + pbId))?.[0];
  if (!pb) return { skipped: "no such response" };
  const a = pb.answers || {};
  const inq = (await rest("venue_inquiries?select=*&prebooking_form_response_id=eq." + pbId + "&limit=1"))?.[0] || null;
  if (!(await hasPayment(pb, inq))) return { skipped: "no payment yet, so no Drive folder" };
  const { folderId, folderName, name, date } = await clientFolder(pbId, a, inq);
  const have = await listChildren(folderId);
  if (have.some((f) => f.name.toLowerCase().startsWith("invoice"))) return { folder: folderName, skipped: "invoice already filed" };
  const inv = await invoiceData(pb, inq, name, date);
  if (!inv || !(inv.lines.length || inv.payments.length)) return { folder: folderName, skipped: "no invoice on record" };
  await uploadFile("Invoice.pdf", folderId, "application/pdf", await invoicePdf(inv));
  return { folder: folderName, added: ["Invoice"] };
}

// The site manager's final paperwork from the event (checklists, notes, incident forms), uploaded from
// the Portal's client page: filed in the client's Drive folder and listed on the client's record.
const PAPERWORK_TYPES = /^(application\/pdf|image\/(jpeg|png|heic|heif|webp|gif)|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|text\/plain)$/;
const PAPERWORK_MAX = 10 * 1024 * 1024;
// Same branded look as the Portal's other venue emails (send-email's brandPlain), with a Drive button.
const LOGO_URL = "https://northstarhouse.github.io/venue/assets/logo.png";
function paperworkEmailHtml(client: string, when: string, siteManager: string, fileName: string, fileUrl: string) {
  const row = (k: string, v: string) => `<tr><td style="padding:6px 0;font-size:13px;color:#888;width:120px;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;font-size:15px;color:#2a2420;">${esc(v)}</td></tr>`;
  return `<div style="background:#f7f3ec;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e8e0d5;overflow:hidden;">
<div style="background:#6b5232;padding:22px;text-align:center;"><img src="${LOGO_URL}" alt="North Star House" width="170" style="display:block;margin:0 auto;max-width:170px;height:auto;"></div>
<div style="height:4px;background:#886c44;"></div>
<div style="padding:30px 36px;"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#2a2420;">Final Site Manager Paperwork</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#444;">The site manager's final paperwork was uploaded in the Portal. The file is attached and saved in the client's Drive folder.</p>
<table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 24px;">${row("Client", client)}${row("Event date", when)}${row("Site manager", siteManager || "Not assigned in the Portal")}${row("File", fileName)}</table>
<div style="text-align:center;"><a href="${esc(fileUrl)}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:6px;">Open in Google Drive</a></div></div>
<div style="background:#f7f3ec;padding:16px 36px;border-top:1px solid #e8e0d5;text-align:center;font-size:11px;color:#999;">North Star House</div></div></div>`;
}

// Each upload is also emailed, with the file attached, to these addresses.
const PAPERWORK_EMAIL_TO = ["media@thenorthstarhouse.org", "wyn.spiller@gmail.com"];
async function emailPaperwork(fileName: string, data: string, client: string, date: string, siteManager: string, fileUrl: string, isTest = false) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const when = /^\d{4}-\d{2}-\d{2}$/.test(date) ? writtenDate(date) : "date to confirm";
  const lines = [
    `Final site manager paperwork was uploaded in the Portal for ${client} (event ${when}).`,
    `Site manager: ${siteManager || "not assigned in the Portal"}`,
    `File: ${fileName} (attached)`,
    `Saved in the client's Drive folder: ${fileUrl}`,
  ];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Venue Portal · North Star House <venue@northstarhouse.org>",
      // test bookings (+test@ addresses) only go to media@
      to: isTest ? PAPERWORK_EMAIL_TO.slice(0, 1) : PAPERWORK_EMAIL_TO,
      subject: `FINAL site manager paperwork: ${client} (${when})`,
      text: lines.join("\n\n"),
      html: paperworkEmailHtml(client, when, siteManager, fileName, fileUrl),
      attachments: [{ filename: fileName, content: data }],
    }),
  });
  if (!r.ok) console.error("paperwork email failed", r.status, await r.text());
  return r.ok;
}
async function uploadSiteManagerPaperwork(pbId: string, filename: string, mimeType: string, data: string) {
  if (!PAPERWORK_TYPES.test(mimeType)) throw new Error("Upload a PDF, photo, Word or Excel file.");
  const raw = atob(data);
  if (raw.length > PAPERWORK_MAX) throw new Error("That file is over 10 MB. Please upload a smaller copy.");
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const pb = (await rest(`nsh_form_responses?select=id,form_id,answers&id=eq.${pbId}`))?.[0];
  if (!pb) throw new Error("Client not found.");
  const inq = (await rest(`venue_inquiries?select=*&prebooking_form_response_id=eq.${pbId}&limit=1`))?.[0] || null;
  const { folderId, folderUrl, name, date } = await clientFolder(pbId, pb.answers || {}, inq);
  const fileName = `FINAL - Site Manager Paperwork - ${clean(filename) || "upload"}`;
  const up = await uploadFile(fileName, folderId, mimeType, bytes);
  const entry = { name: fileName, file_id: up.id, url: `https://drive.google.com/file/d/${up.id}/view`, folder_url: folderUrl, uploaded_at: new Date().toISOString() };
  // read again just before saving, so a checklist change made meanwhile is kept
  const cur = (await rest(`nsh_form_responses?select=answers&id=eq.${pbId}`))?.[0]?.answers || {};
  const checklist = { ...(cur.__venue_checklist || {}) };
  checklist.site_manager_paperwork = [...(Array.isArray(checklist.site_manager_paperwork) ? checklist.site_manager_paperwork : []), entry];
  const saved = await rest(`nsh_form_responses?id=eq.${pbId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ answers: { ...cur, __venue_checklist: checklist } }) });
  // the file is saved either way; the email is a copy, so a failure there is only reported
  const isTest = Object.values(pb.answers || {}).some((v) => typeof v === "string" && /\+test@thenorthstarhouse\.org/i.test(v));
  const emailed = await emailPaperwork(fileName, data, name, date, String(checklist.site_manager?.name || ""), entry.url, isTest).catch(() => false);
  return { file: entry, record: saved?.[0] || null, emailed };
}

// One sync per client at a time: a second submission arriving together waits its turn (and then finds the first one's work already done).
async function syncLocked(pbId: string) {
  let claimed = false;
  for (let i = 0; i < 6 && !claimed; i++) {
    claimed = (await rest("rpc/claim_drive_lock", { method: "POST", body: JSON.stringify({ p_id: pbId }) })) === true;
    if (!claimed) await new Promise((r) => setTimeout(r, 8000));
  }
  if (!claimed) return { skipped: "busy, will be picked up by the next submission" };
  try { return await syncClient(pbId); }
  finally { await rest("rpc/release_drive_lock", { method: "POST", body: JSON.stringify({ p_id: pbId }) }).catch(() => {}); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "ping") {
      const token = await driveToken();
      const r = await fetch(`${D}/${ROOT_FOLDER_ID}?supportsAllDrives=true&fields=id,name,capabilities(canAddChildren)`, { headers: { Authorization: `Bearer ${token}` } });
      return json({ ok: r.ok, status: r.status });
    }
    if (body.action === "sync") {
      const id = String(body.response_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "response_id required" }, 400);
      const pbId = await resolvePrebookingId(id);
      if (!pbId) return json({ ok: true, skipped: "not tied to a client" });
      return json({ ok: true, ...(await syncLocked(pbId)) });
    }
    if (body.action === "contract") {
      const id = String(body.response_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "response_id required" }, 400);
      const pbId = await resolvePrebookingId(id);
      if (!pbId) return json({ ok: true, skipped: "not tied to a client" });
      return json({ ok: true, ...(await contractOnly(pbId)) });
    }
    if (body.action === "invoice") {
      const id = String(body.response_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "response_id required" }, 400);
      const pbId = await resolvePrebookingId(id);
      if (!pbId) return json({ ok: true, skipped: "not tied to a client" });
      return json({ ok: true, ...(await invoiceOnly(pbId)) });
    }
    if (body.action === "upload_site_manager") {
      const id = String(body.response_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "response_id required" }, 400);
      const pbId = await resolvePrebookingId(id);
      if (!pbId) return json({ error: "Client not found." }, 404);
      try {
        return json({ ok: true, ...(await uploadSiteManagerPaperwork(pbId, String(body.filename || ""), String(body.mime_type || ""), String(body.data || ""))) });
      } catch (e: any) {
        return json({ ok: false, error: e.message || String(e) }, 400);
      }
    }
    if (body.action === "backfill") {
      // heavy, so only callable with the service key (it was run once for the existing clients)
      if ((req.headers.get("authorization") || "") !== `Bearer ${SERVICE_KEY}`) return json({ error: "Not allowed" }, 403);
      // every client's pre-booking form, a few at a time: { offset, limit }
      const offset = Number(body.offset) || 0, limit = Math.min(Number(body.limit) || 5, 10);
      const rows = await rest(`nsh_form_responses?select=id&form_id=in.(${WEDDING_PREBOOKING},${EVENT_PREBOOKING})&order=created_at.asc&limit=${limit}&offset=${offset}`);
      const out: unknown[] = [];
      for (const r of rows || []) { try { out.push({ id: r.id, ...(await syncLocked(r.id)) }); } catch (e: any) { out.push({ id: r.id, error: e.message }); } }
      return json({ ok: true, count: (rows || []).length, next: (rows || []).length === limit ? offset + limit : null, results: out });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e.message || String(e) }, 500);
  }
});
