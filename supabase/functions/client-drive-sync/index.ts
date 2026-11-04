// Files each venue client's paperwork into Google Drive:
//   <Closing Events Paperwork>/<event year>/<event date - client name>/
//     Pre-Booking Form, Pre-Event Questionnaire, Post-Event Feedback Form (Google Docs),
//     Insurance (copied from the client's insurance upload), Signed Contract (PDF).
// `sync` is safe to run any number of times: it only adds what is missing (the questionnaire is refreshed if the client changed it).
// It is called by database triggers whenever one of those things is submitted, and can be run for every client with `backfill`.
import { contractPdf } from "./contract-pdf.ts";
import { formPdf, type FormItem } from "./form-pdf.ts";

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

async function syncClient(pbId: string) {
  const pb = (await rest(`nsh_form_responses?select=id,form_id,answers,created_at&id=eq.${pbId}`))?.[0];
  if (!pb) return { skipped: "no such response" };
  const a = pb.answers || {};
  if (Object.values(a).some((v) => typeof v === "string" && /\+test@thenorthstarhouse\.org/i.test(v))) return { skipped: "test booking" };
  const inq = (await rest(`venue_inquiries?select=*&prebooking_form_response_id=eq.${pbId}&limit=1`))?.[0] || null;

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
  const have = await listChildren(folderId);
  const has = (prefix: string) => have.find((f) => f.name.toLowerCase().startsWith(prefix.toLowerCase()));
  const done: string[] = [];

  const formDoc = async (label: string, formId: string, answers: Record<string, any> | null, when: string | null, refresh = false) => {
    if (!answers || !Object.keys(answers).length) return;
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

  return { folder: folderName, url: rec.folder_url, added: done };
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
