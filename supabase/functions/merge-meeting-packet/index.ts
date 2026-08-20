// Merges every attachment for one month's Board Agenda into a single PDF
// "packet" -- called from the Meeting & Board Reports tab's "View / Download
// Full Packet" button so staff see one combined document in-app instead of
// browsing a Drive folder file by file. Just the documents back to back --
// no cover page, no divider pages between sections. The merged PDF is also
// saved (or overwritten, if regenerated) as an actual file in that month's
// Drive folder -- "<Month Year> - Board Packet.pdf" -- so it persists there
// as one file alongside the individual attachments.
//
// POST body: {
//   monthLabel: string,   // e.g. "August 2026" -- names the saved packet file
//   files: Array<{ fileId: string, title: string, category: string }>
//          -- in the exact order they should appear in the packet
// }
//
// Response: on success, the raw merged PDF bytes (Content-Type: application/pdf),
// with the Drive file's link in an X-Packet-Drive-Url header.
// On failure, JSON { success: false, error }.

import { PDFDocument } from "npm:pdf-lib@1.17.1";

const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

// Same Shared Drive root Meeting & Board Reports lives in (see upload-meeting-report).
const MEETING_REPORTS_PARENT_FOLDER_ID = "1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-token",
  "Access-Control-Expose-Headers": "X-Packet-Drive-Url",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ---------- Google service-account auth (same pattern as upload-meeting-report) ----------

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

// ---------- Drive file fetch ----------

async function getFileMeta(fileId: string, token: string): Promise<{ mimeType: string; name: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=mimeType,name`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive metadata lookup failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function downloadBytes(url: string, token: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

const GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps.";

// ---------- Drive folder + save-back ----------

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

async function findFileInFolder(name: string, folderId: string, token: string): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const q = `name='${escaped}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive file lookup failed: ${res.status} ${await res.text()}`);
  const found = await res.json();
  return found.files && found.files.length > 0 ? found.files[0].id : null;
}

// Saves the merged PDF into the month's folder -- replacing the previous
// packet file of the same name if this is a regeneration, so re-running it
// doesn't pile up duplicates.
async function savePacketToDrive(monthLabel: string, filename: string, bytes: Uint8Array, token: string): Promise<{ id: string; webViewLink: string }> {
  const rootId = await driveFindOrCreateFolder("Meeting & Board Reports", MEETING_REPORTS_PARENT_FOLDER_ID, token);
  const folderId = await driveFindOrCreateFolder(monthLabel, rootId, token);
  const existingId = await findFileInFolder(filename, folderId, token);

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media&supportsAllDrives=true&fields=id,webViewLink`,
      { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/pdf" }, body: bytes },
    );
    if (!res.ok) throw new Error(`Drive packet update failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  const metadata = { name: filename, parents: [folderId] };
  const boundary = `nsh-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--`),
  ];
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: new Blob(parts) },
  );
  if (!res.ok) throw new Error(`Drive packet create failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------- Packet assembly ----------
// Just the documents, concatenated in order -- no cover page, no divider
// pages between sections. Files that can't be embedded (unsupported type,
// fetch/convert failure) are silently skipped rather than replaced with a
// placeholder page.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

  try {
    const body = await req.json();
    const { monthLabel, files } = body as { monthLabel?: string; files: Array<{ fileId: string; title: string; category: string }> };
    if (!Array.isArray(files) || files.length === 0) return json({ success: false, error: "Nothing to merge -- no attachments for this month." }, 400);

    const token = await getDriveAccessToken();
    const merged = await PDFDocument.create();
    let includedCount = 0;

    for (const f of files) {
      try {
        const meta = await getFileMeta(f.fileId, token);
        let pdfBytes: Uint8Array | null = null;
        let imageBytes: Uint8Array | null = null;
        let imageKind: "jpg" | "png" | null = null;

        if (meta.mimeType === "application/pdf") {
          pdfBytes = await downloadBytes(`https://www.googleapis.com/drive/v3/files/${f.fileId}?alt=media&supportsAllDrives=true`, token);
        } else if (meta.mimeType.startsWith(GOOGLE_NATIVE_PREFIX)) {
          pdfBytes = await downloadBytes(`https://www.googleapis.com/drive/v3/files/${f.fileId}/export?mimeType=application/pdf`, token);
        } else if (meta.mimeType === "image/jpeg" || meta.mimeType === "image/jpg") {
          imageBytes = await downloadBytes(`https://www.googleapis.com/drive/v3/files/${f.fileId}?alt=media&supportsAllDrives=true`, token);
          imageKind = "jpg";
        } else if (meta.mimeType === "image/png") {
          imageBytes = await downloadBytes(`https://www.googleapis.com/drive/v3/files/${f.fileId}?alt=media&supportsAllDrives=true`, token);
          imageKind = "png";
        }

        if (pdfBytes) {
          const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
          includedCount++;
        } else if (imageBytes && imageKind) {
          const img = imageKind === "jpg" ? await merged.embedJpg(imageBytes) : await merged.embedPng(imageBytes);
          const maxW = 612, maxH = 792; // cap page size at Letter even if the photo is huge
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          const page = merged.addPage([w, h]);
          page.drawImage(img, { x: 0, y: 0, width: w, height: h });
          includedCount++;
        }
        // Anything else (unsupported type) is silently skipped.
      } catch {
        // Fetch/convert failure for this one file -- skip it, keep going.
      }
    }

    if (includedCount === 0) return json({ success: false, error: "None of this month's attachments could be included in the packet." }, 400);

    const outBytes = await merged.save();

    let driveUrl = "";
    if (monthLabel) {
      try {
        const saved = await savePacketToDrive(monthLabel, `${monthLabel} - Board Packet.pdf`, outBytes, token);
        driveUrl = saved.webViewLink || "";
      } catch {
        // The in-app view/download still works even if saving the copy to
        // Drive fails -- don't fail the whole request over it.
      }
    }

    return new Response(outBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", ...(driveUrl ? { "X-Packet-Drive-Url": driveUrl } : {}), ...CORS_HEADERS },
    });
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
