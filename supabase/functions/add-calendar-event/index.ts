// Creates a real Google Calendar event on the North Star House calendar from
// arbitrary caller-supplied details -- unlike add-tour-to-calendar (which is
// hardwired to the estate_tours table via a DB trigger), this one just takes
// a summary/description/date/time and inserts it directly. Built for
// Volunteer Hub's "Add Scheduled Docent Tour to Calendar" button, where the
// source data (nsh_form_responses.answers) has no date/time fields of its
// own -- the docent picks the actual scheduled date/time by hand.
//
// Reuses the same Google service account already set up for Drive/Calendar
// (see generate-acknowledgment and add-tour-to-calendar) -- the calendar
// (thenorthstarhouse@gmail.com) must already be shared with that service
// account's client_email with "Make changes to events", which it is.
//
// POST body: {
//   summary: string,
//   description?: string,
//   date: string,        // YYYY-MM-DD
//   startTime: string,   // HH:MM, 24h
//   durationMin?: number // defaults to 45
// }
// Response: { ok: true, eventId, htmlLink } | { error }

const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
const CALENDAR_ID = "thenorthstarhouse@gmail.com";
const TIME_ZONE = "America/Los_Angeles";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, x-app-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// ---------- Google service-account auth (same JWT/OAuth2 flow as add-tour-to-calendar) ----------

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

async function getCalendarAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar.events",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { summary, description, date, startTime, durationMin } = await req.json();
    if (!summary || !date || !startTime) return json({ error: "summary, date, and startTime are required" }, 400);

    const duration = Number(durationMin ?? 45);
    if (!Number.isFinite(duration) || duration <= 0) return json({ error: "durationMin must be a positive number" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(startTime)) {
      return json({ error: "Invalid date/startTime" }, 400);
    }
    const startDateTime = `${date}T${startTime.length === 5 ? startTime + ':00' : startTime}`;
    const startMs = new Date(`${startDateTime}Z`).getTime(); // wall-clock arithmetic only; timeZone below governs the real offset
    if (Number.isNaN(startMs) || new Date(startMs).toISOString().slice(0, 10) !== date) return json({ error: "Invalid date/startTime" }, 400);
    const endDateTime = new Date(startMs + duration * 60000).toISOString().slice(0, 19);

    const token = await getCalendarAccessToken();
    const eventRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          description: description || undefined,
          start: { dateTime: startDateTime, timeZone: TIME_ZONE },
          end: { dateTime: endDateTime, timeZone: TIME_ZONE },
          organizer: { displayName: "North Star House" },
        }),
      },
    );
    if (!eventRes.ok) {
      const errText = await eventRes.text();
      return json({ error: `Calendar insert failed: ${eventRes.status} ${errText}` }, 502);
    }
    const event = await eventRes.json();

    return json({ ok: true, eventId: event.id, htmlLink: event.htmlLink });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
