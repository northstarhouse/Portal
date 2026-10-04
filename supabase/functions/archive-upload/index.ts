// Volunteer Hub "Upload Photos & Documents" -- routes files into the EXISTING
// North Star House Google Drive folders, so volunteers never touch Drive and
// staff never maintain a second category list.
//
// Categories are read live from Drive: the top-level folders of
//   Photographs (PHOTOS_ROOT)  -> "Pick the category that best fits"
//   Documents   (DOCS_ROOT)    -> "What type of document are you uploading?"
// Add, rename, or remove a folder there and the Hub's dropdown follows
// (cached ~5 min). Folders whose names start with "_" are hidden.
// "Other" uploads go to each root's unsorted folder (photos: "Other",
// documents: "Needs organizing") for staff to file later.
//
// Files are NOT sent through this function -- it creates a Google Drive
// resumable-upload session (service-account auth) and returns the session
// URL; the browser PUTs the file bytes straight to Google. That keeps large
// videos working (no request-size or memory limits here).
//
// POST { action: "categories" }
//   -> { success, photo: [{ id, label }], document: [{ id, label }] }
// POST { action: "start", kind: "photo"|"document", categoryId | "other",
//        otherText?, filename, mimeType, size, title?, description?, date?,
//        uploaderName?, index?, total? }
//   -> { success, uploadUrl, folderUrl }
// POST { action: "done", kind, categoryLabel, count, uploaderName? }
//   -> { success }   (activity log entry for the batch)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

const PHOTOS_ROOT = "1sQmw-Gw65-SSp786cZG9-zNFEsz8jb5e"; // "Photographs"
const DOCS_ROOT = "1N9mnKscP4fAs8qSY7QOZEmm4JfQUnBP2"; // "Documents"

// Unsorted folder per kind, matched by name (first match wins). These are
// also left out of the dropdown, since "Other" covers them.
const UNSORTED_NAMES: Record<string, string[]> = {
  photo: ["other"],
  document: ["needs organizing", "other"],
};

// Browser origins allowed to upload. Google's resumable session only accepts
// the browser PUT from the Origin the session was created for.
const ALLOWED_ORIGINS = [
  "https://volunteerhub.northstarhouse.org",
  "https://northstarhouse.github.io",
];
const isAllowedOrigin = (o: string) => ALLOWED_ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// ---------- Google service-account auth (same pattern as upload-archive-file) ----------

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
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${encHeader}.${encClaims}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${signingInput}.${base64url(signature)}`,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// ---------- Categories (live from Drive) ----------

type Folder = { id: string; name: string };
type Category = { id: string; label: string };
type KindCats = { categories: Category[]; unsortedId: string | null; byId: Map<string, Category> };

const CACHE_MS = 5 * 60_000;
let catCache: { at: number; photo: KindCats; document: KindCats } | null = null;

async function listChildFolders(parentId: string, token: string): Promise<Folder[]> {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1000&orderBy=name&includeItemsFromAllDrives=true&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive folder list failed: ${res.status} ${await res.text()}`);
  return ((await res.json()).files || []) as Folder[];
}

// "03- Construction" -> "Construction" (keeps Drive's numbered ordering
// without showing the numbers to volunteers).
const labelOf = (name: string) => name.replace(/^\s*\d+\s*[-.)]\s*/, "").trim() || name.trim();

function buildKind(folders: Folder[], kind: string): KindCats {
  const unsortedNames = UNSORTED_NAMES[kind] || [];
  let unsortedId: string | null = null;
  for (const want of unsortedNames) {
    const hit = folders.find((f) => labelOf(f.name).toLowerCase() === want);
    if (hit) { unsortedId = hit.id; break; }
  }
  const categories = folders
    .filter((f) => !f.name.trim().startsWith("_"))
    .filter((f) => !unsortedNames.includes(labelOf(f.name).toLowerCase()))
    .map((f) => ({ id: f.id, label: labelOf(f.name) }));
  return { categories, unsortedId, byId: new Map(categories.map((c) => [c.id, c])) };
}

async function getCategories(token: string, fresh = false) {
  if (!fresh && catCache && Date.now() - catCache.at < CACHE_MS) return catCache;
  const [photos, docs] = await Promise.all([listChildFolders(PHOTOS_ROOT, token), listChildFolders(DOCS_ROOT, token)]);
  catCache = { at: Date.now(), photo: buildKind(photos, "photo"), document: buildKind(docs, "document") };
  return catCache;
}

// ---------- Naming ----------

const clean = (s: unknown, max = 60) =>
  String(s || "").replace(/[\\/:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();

function extOf(filename: string) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

function driveName(p: { kind: string; filename: string; title?: string; description?: string; otherText?: string; categoryLabel: string; date?: string; uploaderName?: string; index?: number; total?: number }) {
  const ext = extOf(p.filename);
  const n = (p.total || 1) > 1 ? ` (${(p.index ?? 0) + 1} of ${p.total})` : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || "") ? p.date! : new Date().toISOString().slice(0, 10);
  let base: string;
  if (p.kind === "document") {
    // A given title is the name; otherwise keep the file's own name (documents
    // usually already have meaningful ones), just date-prefixed.
    base = clean(p.title) ? `${clean(p.title, 90)}${n}` : `${date} - ${clean(p.filename.replace(/\.[^.]+$/, ""), 90)}`;
  } else {
    // Phone photo names (IMG_1234) mean nothing -- name it by what it is.
    const subject = clean(p.description, 50) || clean(p.otherText, 50) || p.categoryLabel;
    const who = clean(p.uploaderName, 40);
    base = `${date} - ${subject}${who ? ` - ${who}` : ""}${n}`;
  }
  return ext ? `${base}.${ext}` : base;
}

// ---------- HTTP entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ success: false, error: "Unsupported method" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = await getDriveAccessToken();

    if (body.action === "categories") {
      const c = await getCategories(token, Boolean(body.fresh));
      return json({ success: true, photo: c.photo.categories, document: c.document.categories });
    }

    if (body.action === "start") {
      const kind = body.kind === "document" ? "document" : body.kind === "photo" ? "photo" : null;
      if (!kind) return json({ success: false, error: "kind must be photo or document" }, 400);
      const { filename, mimeType } = body;
      const size = Number(body.size);
      if (!filename || !Number.isFinite(size) || size <= 0) return json({ success: false, error: "filename and size are required" }, 400);

      const origin = req.headers.get("origin") || "";
      if (!isAllowedOrigin(origin)) return json({ success: false, error: "Uploads are only accepted from the Volunteer Hub" }, 403);

      // Only ever write into an existing category folder (or the unsorted
      // one) -- never an arbitrary folder id from the browser.
      let c = await getCategories(token);
      let folderId: string | null = null;
      let categoryLabel = "Other";
      const isOther = body.categoryId === "other";
      if (isOther) {
        if (!clean(body.otherText)) return json({ success: false, error: "Please say what these files are of" }, 400);
        folderId = c[kind].unsortedId;
        if (!folderId) return json({ success: false, error: "No unsorted folder found in Drive" }, 500);
      } else {
        let cat = c[kind].byId.get(String(body.categoryId || ""));
        if (!cat) { c = await getCategories(token, true); cat = c[kind].byId.get(String(body.categoryId || "")); }
        if (!cat) return json({ success: false, error: "That category no longer exists. Please refresh and pick again." }, 400);
        folderId = cat.id;
        categoryLabel = cat.label;
      }

      const name = driveName({ ...body, kind, categoryLabel });
      const descLines = [
        `Category: ${isOther ? `Other - ${clean(body.otherText, 200)}` : categoryLabel}`,
        clean(body.title, 200) ? `Title: ${clean(body.title, 200)}` : null,
        clean(body.description, 1000) ? `Notes: ${clean(body.description, 1000)}` : null,
        /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? `${kind === "document" ? "Document date" : "Date taken"}: ${body.date}` : null,
        clean(body.uploaderName, 80) ? `Uploaded by: ${clean(body.uploaderName, 80)}` : null,
        `Original file name: ${clean(filename, 200)}`,
        `Uploaded via Volunteer Hub: ${new Date().toISOString()}`,
      ].filter(Boolean);

      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType || "application/octet-stream",
            "X-Upload-Content-Length": String(size),
            Origin: origin,
          },
          body: JSON.stringify({ name, parents: [folderId], description: descLines.join("\n") }),
        },
      );
      const uploadUrl = res.headers.get("location");
      if (!res.ok || !uploadUrl) throw new Error(`Drive upload session failed: ${res.status} ${await res.text()}`);
      return json({ success: true, uploadUrl, folderUrl: `https://drive.google.com/drive/folders/${folderId}` });
    }

    if (body.action === "done") {
      const count = Math.max(0, Number(body.count) || 0);
      const who = clean(body.uploaderName, 80);
      await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          description: `${count} ${body.kind === "document" ? "document" : "photo/video"}${count === 1 ? "" : "s"} uploaded to Drive (${clean(body.categoryLabel, 80) || "Other"})${who ? ` by ${who}` : ""}`,
          action: "archive_file_uploaded",
        }),
      }).catch(() => {});
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
