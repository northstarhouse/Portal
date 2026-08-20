// Merges every attachment for one month's Board Agenda into a single PDF
// "packet" -- called from the Meeting & Board Reports tab's "View / Download
// Full Packet" button so staff see one combined document in-app instead of
// browsing a Drive folder file by file.
//
// POST body: {
//   monthLabel: string,   // e.g. "August 2026" -- used in the cover page title
//   files: Array<{ fileId: string, title: string, category: string }>
//          -- in the exact order they should appear in the packet
// }
//
// Response: on success, the raw merged PDF bytes (Content-Type: application/pdf).
// On failure, JSON { success: false, error }.

import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

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
    scope: "https://www.googleapis.com/auth/drive.readonly",
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

// ---------- Packet assembly ----------

function addDividerPage(doc: PDFDocument, font: any, category: string, title: string, note?: string) {
  const page = doc.addPage([612, 792]); // US Letter
  page.drawText(category.toUpperCase(), { x: 56, y: 700, size: 12, font, color: rgb(0.53, 0.42, 0.27) });
  page.drawLine({ start: { x: 56, y: 690 }, end: { x: 556, y: 690 }, thickness: 1, color: rgb(0.85, 0.8, 0.7) });
  page.drawText(title, { x: 56, y: 660, size: 18, font, color: rgb(0.16, 0.14, 0.13), maxWidth: 500 });
  if (note) page.drawText(note, { x: 56, y: 630, size: 11, font, color: rgb(0.5, 0.5, 0.5), maxWidth: 500 });
  return page;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

  try {
    const body = await req.json();
    const { monthLabel, files } = body as { monthLabel: string; files: Array<{ fileId: string; title: string; category: string }> };
    if (!monthLabel) return json({ success: false, error: "monthLabel is required" }, 400);
    if (!Array.isArray(files) || files.length === 0) return json({ success: false, error: "Nothing to merge -- no attachments for this month." }, 400);

    const token = await getDriveAccessToken();
    const merged = await PDFDocument.create();
    const font = await merged.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await merged.embedFont(StandardFonts.Helvetica);

    // Cover page
    const cover = merged.addPage([612, 792]);
    cover.drawText("Board Agenda", { x: 56, y: 700, size: 26, font, color: rgb(0.16, 0.14, 0.13) });
    cover.drawText(monthLabel, { x: 56, y: 668, size: 16, font: bodyFont, color: rgb(0.53, 0.42, 0.27) });
    cover.drawLine({ start: { x: 56, y: 650 }, end: { x: 556, y: 650 }, thickness: 1, color: rgb(0.85, 0.8, 0.7) });
    files.forEach((f, i) => {
      const y = 610 - i * 20;
      if (y < 60) return;
      cover.drawText(`${f.category} — ${f.title}`, { x: 56, y, size: 11, font: bodyFont, color: rgb(0.3, 0.3, 0.3), maxWidth: 500 });
    });

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
          addDividerPage(merged, font, f.category, f.title);
          const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        } else if (imageBytes && imageKind) {
          const page = addDividerPage(merged, font, f.category, f.title);
          const img = imageKind === "jpg" ? await merged.embedJpg(imageBytes) : await merged.embedPng(imageBytes);
          const maxW = 500, maxH = 560;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          page.drawImage(img, { x: 56, y: 600 - h, width: w, height: h });
        } else {
          addDividerPage(merged, font, f.category, f.title, `(${meta.name} — this file type can't be embedded here; open it separately in Drive.)`);
        }
      } catch (fileErr: any) {
        addDividerPage(merged, font, f.category, f.title, `(Could not include this file: ${fileErr.message || fileErr})`);
      }
    }

    const outBytes = await merged.save();
    return new Response(outBytes, { status: 200, headers: { "Content-Type": "application/pdf", ...CORS_HEADERS } });
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
