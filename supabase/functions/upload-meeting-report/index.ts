// Uploads a meeting minutes / board report attachment into a
// "Meeting & Board Reports / <Month Year>" folder living alongside the
// Mail/Checks folders inside the same Acknowledgement Templates Shared
// Drive (same service account already configured for the Donor
// Acknowledgment system) -- see upload-mail for the base pattern.
//
// Word documents (.doc/.docx) are auto-converted to PDF before landing in
// Drive: Drive itself does the conversion (import the file as a temporary
// Google Doc, export that as PDF, delete the temporary Doc).
//
// POST body: {
//   filename: string, mimeType: string, base64: string,
//   monthLabel: string,   // e.g. "August 2026" -- the subfolder to upload into
// }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

// Same Shared Drive root the Acknowledgement Templates / Checks / Mail folders live in.
const MEETING_REPORTS_PARENT_FOLDER_ID = "1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx";

const WORD_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

// ---------- Google service-account auth (same pattern as upload-mail / upload-check) ----------

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
// batch of uploads back-to-back only resolves each folder once.
let warmRootFolderId: string | null = null;
const warmMonthFolderIds = new Map<string, string>();

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

// Resolves (creating as needed) Meeting & Board Reports/<monthLabel>, e.g.
// Meeting & Board Reports/August 2026 -- a fresh folder appears automatically
// the first time anything is uploaded for a given month.
async function resolveMonthFolder(monthLabel: string, token: string) {
  const cached = warmMonthFolderIds.get(monthLabel);
  if (cached) return cached;
  if (!warmRootFolderId) {
    warmRootFolderId = await driveFindOrCreateFolder("Meeting & Board Reports", MEETING_REPORTS_PARENT_FOLDER_ID, token);
  }
  const folderId = await driveFindOrCreateFolder(monthLabel, warmRootFolderId, token);
  warmMonthFolderIds.set(monthLabel, folderId);
  return folderId;
}

async function driveUploadFile(filename: string, bytes: Uint8Array, mimeType: string, folderId: string, token: string) {
  const metadata: Record<string, unknown> = { name: filename, parents: [folderId] };
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

// Imports a Word doc as a Google Doc (Drive auto-converts on import when the
// target mimeType differs from the source), exports it as PDF bytes, then
// discards the temporary Google Doc. Uploaded into a scratch spot in the
// same shared drive (not the visible month folder) since it never needs to
// be seen -- only the resulting PDF does.
async function convertWordToPdf(filename: string, bytes: Uint8Array, mimeType: string, scratchFolderId: string, token: string): Promise<Uint8Array> {
  const metadata = { name: filename, parents: [scratchFolderId], mimeType: "application/vnd.google-apps.document" };
  const boundary = `nsh-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--`),
  ];
  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: new Blob(parts),
    },
  );
  if (!uploadRes.ok) throw new Error(`Word->Doc import failed for ${filename}: ${uploadRes.status} ${await uploadRes.text()}`);
  const { id: tempDocId } = await uploadRes.json();

  try {
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${tempDocId}/export?mimeType=application/pdf`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!exportRes.ok) throw new Error(`Doc->PDF export failed for ${filename}: ${exportRes.status} ${await exportRes.text()}`);
    return new Uint8Array(await exportRes.arrayBuffer());
  } finally {
    await fetch(`https://www.googleapis.com/drive/v3/files/${tempDocId}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- HTTP entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

  try {
    const body = await req.json();
    const { filename, mimeType, base64, monthLabel, resolveOnly } = body;
    if (!monthLabel) return json({ error: "monthLabel is required (e.g. \"August 2026\")" }, 400);

    // Used by the "View / Download Full Packet" button -- just resolves
    // (creating if needed) that month's Drive folder and hands back a link,
    // no file involved.
    if (resolveOnly) {
      const token = await getDriveAccessToken();
      const folderId = await resolveMonthFolder(monthLabel, token);
      return json({ success: true, folderUrl: `https://drive.google.com/drive/folders/${folderId}` });
    }

    if (!filename || !mimeType || !base64) return json({ error: "filename, mimeType, and base64 are required" }, 400);

    let bytes = base64ToBytes(base64);
    const token = await getDriveAccessToken();
    const folderId = await resolveMonthFolder(monthLabel, token);

    let finalFilename = filename;
    let finalMimeType = mimeType;
    const isWordDoc = WORD_MIME_TYPES.has(mimeType) || /\.docx?$/i.test(filename);
    if (isWordDoc) {
      bytes = await convertWordToPdf(filename, bytes, mimeType, folderId, token);
      finalFilename = filename.replace(/\.docx?$/i, "") + ".pdf";
      finalMimeType = "application/pdf";
    }

    const uploaded = await driveUploadFile(finalFilename, bytes, finalMimeType, folderId, token);

    await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        description: "Meeting/board report uploaded: " + finalFilename,
        action: "meeting_report_uploaded",
      }),
    }).catch(() => {});

    return json({ success: true, url: uploaded.webViewLink, fileId: uploaded.id, filename: finalFilename });
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
