// Uploads a reimbursement receipt into a "Reimbursements" folder living
// alongside Checks/Mail/Acknowledgements inside the same Portal Backend
// Shared Drive, using the same service account already configured for the
// Donor Acknowledgment system.
//
// POST body: { filename: string, mimeType: string, base64: string }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

// Same Shared Drive root the Acknowledgements/Checks/Mail folders live in.
const RECEIPTS_PARENT_FOLDER_ID = "1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx";

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

// ---------- Google service-account auth (same pattern as generate-acknowledgment / upload-check / upload-mail) ----------

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
// batch of receipt uploads back-to-back only resolves the "Reimbursements"
// folder once.
let warmReceiptsFolderId: string | null = null;

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

async function resolveReceiptsFolder(token: string) {
  if (warmReceiptsFolderId) return warmReceiptsFolderId;
  warmReceiptsFolderId = await driveFindOrCreateFolder("Reimbursements", RECEIPTS_PARENT_FOLDER_ID, token);
  return warmReceiptsFolderId;
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

// ---------- HTTP entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

  try {
    const body = await req.json();
    const { filename, mimeType, base64 } = body;
    if (!filename || !mimeType || !base64) return json({ error: "filename, mimeType, and base64 are required" }, 400);

    const bytes = base64ToBytes(base64);
    const token = await getDriveAccessToken();
    const folderId = await resolveReceiptsFolder(token);
    const uploaded = await driveUploadFile(filename, bytes, mimeType, folderId, token);

    return json({ success: true, url: uploaded.webViewLink, fileId: uploaded.id });
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
