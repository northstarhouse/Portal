// Files each venue client's paperwork into Google Drive: <root>/<event year>/<client name - event date>/
// (insurance, signed contract, pre-booking form, pre-event questionnaire, post-event feedback form).
// Phase 1 (this version): ping, to check the service account can see and write to the folder.

const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
const ROOT_FOLDER_ID = "1sPNpV0TQlwThYxjq4EDxvTGmmWgTJvYa";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-token",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...CORS } });

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "ping") {
      const token = await driveToken();
      const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${ROOT_FOLDER_ID}?supportsAllDrives=true&fields=id,name,mimeType,driveId,capabilities(canAddChildren)`, { headers: { Authorization: `Bearer ${token}` } });
      const info = await r.json();
      return json({ ok: r.ok, status: r.status, folder: r.ok ? info : undefined, serviceAccount: sa.client_email, error: r.ok ? undefined : (info?.error?.message || "no access") });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e.message || String(e) }, 500);
  }
});
