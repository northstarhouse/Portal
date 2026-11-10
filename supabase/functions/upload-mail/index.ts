// Uploads a scan of general mail into a "Mail" folder living alongside the
// Checks/month folders inside the same Acknowledgement Templates Shared Drive
// (acknowledgment_settings.output_folder_id), using the same service account
// already configured for the Donor Acknowledgment system.
//
// POST body: { filename: string, mimeType: string, base64: string, kind?: "mail" | "check" }
// kind "check" files the scan in the shared Checks folder instead. Either way Wyn is emailed a link (copy to media@),
// and the upload is written to the Activity Log with its Drive link, who uploaded it and whether the email went out;
// failed uploads are logged too. Tools > Mail & Checks lists them.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

// Same Shared Drive root the Acknowledgement Templates / Checks folders live in.
const MAIL_PARENT_FOLDER_ID = "1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const sbHeaders = (extra?: Record<string, string>) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

// ---------- Google service-account auth (same pattern as generate-acknowledgment / upload-check) ----------

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${encHeader}.${encClaims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// ---------- Drive folder + upload ----------

// Warm cache: survives across invocations of the same function instance, so a
// batch of mail uploads back-to-back only resolves the "Mail" folder once.
let warmMailFolderId: string | null = null;

async function driveFindOrCreateFolder(name: string, parentId: string, token: string) {
  const escaped = name.replace(/'/g, "\\'");
  const q = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!listRes.ok) throw new Error(`Drive folder lookup failed: ${listRes.status} ${await listRes.text()}`);
  const found = await listRes.json();
  if (found.files && found.files.length > 0) return found.files[0].id as string;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!createRes.ok) throw new Error(`Drive folder create failed: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json();
  return created.id as string;
}

async function resolveMailFolder(token: string) {
  if (warmMailFolderId) return warmMailFolderId;
  warmMailFolderId = await driveFindOrCreateFolder("Mail", MAIL_PARENT_FOLDER_ID, token);
  return warmMailFolderId;
}

async function driveUploadFile(filename: string, bytes: Uint8Array, mimeType: string, folderId: string, token: string) {
  const metadata = { name: filename, parents: [folderId] };
  const boundary = `nsh-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--`),
  ];
  const body = new Blob(parts);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed for ${filename}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ id: string; webViewLink: string }>;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- Checks folder, notifications, log ----------

// The shared "Checks" folder (same one upload-check files donation checks into).
const CHECKS_FOLDER_ID = "1H_XL4zTyR8la-QB5pty8pRiGzXJ9lvNT";
const WYN_EMAIL = "wyn.spiller@gmail.com";
const LOGO_URL = "https://northstarhouse.github.io/venue/assets/logo.png";

function noticeHtml(headline: string, line: string, url: string) {
  return `<div style="background:#f7f3ec;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e8e0d5;overflow:hidden;">
<div style="background:#6b5232;padding:22px;text-align:center;"><img src="${LOGO_URL}" alt="North Star House" width="170" style="display:block;margin:0 auto;max-width:170px;height:auto;"></div>
<div style="height:4px;background:#886c44;"></div>
<div style="padding:30px 36px;text-align:center;"><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#2a2420;">${headline}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#555;">${line}</p>
<a href="${url}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:6px;">View in Google Drive</a></div>
<div style="background:#f7f3ec;padding:16px 36px;border-top:1px solid #e8e0d5;text-align:center;font-size:11px;color:#999;">North Star House</div></div></div>`;
}

async function signedInName(token: string) {
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_sessions?select=actor_name&token=eq.${encodeURIComponent(token)}&expires_at=gt.${new Date().toISOString()}`, { headers: sbHeaders() });
    const rows = r.ok ? await r.json() : [];
    return rows?.[0]?.actor_name || null;
  } catch { return null; }
}

const logRow = (row: Record<string, unknown>) => fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
  method: "POST", headers: sbHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(row),
}).catch(() => {});

// ---------- HTTP entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

  let kind: "mail" | "check" = "mail";
  let filename = "";
  let by: string | null = null;
  try {
    const body = await req.json();
    kind = body.kind === "check" ? "check" : "mail";
    filename = String(body.filename || "");
    const { mimeType, base64 } = body;
    by = await signedInName(req.headers.get("x-app-token") || "");
    if (!filename || !mimeType || !base64) return json({ error: "filename, mimeType, and base64 are required" }, 400);

    const bytes = base64ToBytes(base64);
    const token = await getDriveAccessToken();
    const folderId = kind === "check" ? CHECKS_FOLDER_ID : await resolveMailFolder(token);
    const uploaded = await driveUploadFile(filename, bytes, mimeType, folderId, token);

    // Tell Wyn (copy to media@ is added by send-email).
    const label = kind === "check" ? "Check" : "Mail";
    let emailed = false, emailError: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          to: [WYN_EMAIL],
          subject: `New ${label} Uploaded`,
          body: `New ${label} Uploaded\n\n${kind === "check" ? "A new check" : "New mail"} has been uploaded for your review.\n\nView in Google Drive: ${uploaded.webViewLink}`,
          html: noticeHtml(`New ${label} Uploaded`, `${kind === "check" ? "A new check has" : "New mail has"} been uploaded for your review.`, uploaded.webViewLink),
        }),
      });
      emailed = r.ok;
      if (!r.ok) emailError = `email service ${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) { emailError = (e as Error).message; }

    await logRow({
      action: kind === "check" ? "check_uploaded" : "mail_uploaded",
      tag: kind === "check" ? "Check" : "Mail",
      description: `${label} uploaded: ${filename}`,
      volunteer_name: by,
      detail: { url: uploaded.webViewLink, file_id: uploaded.id, filename, by, emailed, emailed_to: emailed ? [WYN_EMAIL] : [], email_error: emailError },
    });

    return json({ success: true, url: uploaded.webViewLink, fileId: uploaded.id, emailed });
  } catch (err: any) {
    const msg = err?.message || String(err);
    await logRow({
      action: kind === "check" ? "check_upload_failed" : "mail_upload_failed",
      tag: kind === "check" ? "Check" : "Mail",
      description: `${kind === "check" ? "Check" : "Mail"} upload FAILED: ${filename || "(no file)"}`,
      volunteer_name: by,
      detail: { filename, by, error: msg.slice(0, 300) },
    });
    return json({ success: false, error: msg }, 500);
  }
});
