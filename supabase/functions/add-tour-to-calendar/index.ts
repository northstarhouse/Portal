// Creates a real Google Calendar event for a booked estate tour. Invoked by
// a Postgres trigger (see add_tour_calendar_sync.sql) whenever an
// estate_tours row's status becomes 'booked' -- works regardless of which
// app performed the write (the public booking site's atomic claim, or
// Portal's own "Schedule a Tour"), since the hook is on the table itself.
//
// Reuses the same GOOGLE_SERVICE_ACCOUNT_KEY already set up for Drive (see
// generate-acknowledgment/index.ts) with an added Calendar scope, rather
// than provisioning a second service account. The calendar
// (thenorthstarhouse@gmail.com) must be shared with that service account's
// client_email, granting "Make changes to events" -- a service account has
// no calendar access by default even with the right OAuth scope, and that
// sharing step has to be done once by hand in Google Calendar's own
// settings, not from here.
//
// POST body: { id: uuid } -- the estate_tours row id. Looks the row up
// itself (rather than trusting a full payload from the trigger) so it
// always acts on current data.
//
// Idempotent: does nothing if the row already has a gcal_event_id (set
// after a successful create), so a retried trigger delivery or a second
// UPDATE that leaves status='booked' can't create a duplicate event.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
const CALENDAR_ID = "thenorthstarhouse@gmail.com";
const TIME_ZONE = "America/Los_Angeles";

const sbHeaders = (extra?: Record<string, string>) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path} failed: ${res.status} ${await res.text()}`);
}

// ---------- Google service-account auth (same JWT/OAuth2 flow as
// generate-acknowledgment, scoped to Calendar instead of Drive) ----------

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

type Tour = {
  id: string;
  date: string | null;
  start_time: string | null;
  duration_min: number | null;
  guide_name: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: string;
  gcal_event_id: string | null;
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400 });

    const rows: Tour[] = await sbGet(`estate_tours?id=eq.${encodeURIComponent(id)}&select=*`);
    const tour = rows[0];
    if (!tour) return new Response(JSON.stringify({ error: "No tour with that id" }), { status: 404 });
    if (tour.status !== "booked") return new Response(JSON.stringify({ ok: true, skipped: "not booked" }));
    if (tour.gcal_event_id) return new Response(JSON.stringify({ ok: true, skipped: "already synced", eventId: tour.gcal_event_id }));
    if (!tour.date || !tour.start_time) return new Response(JSON.stringify({ ok: true, skipped: "missing date/time" }));

    const duration = tour.duration_min || 45;
    const startDateTime = `${tour.date}T${tour.start_time}`;
    const startMs = new Date(`${tour.date}T${tour.start_time}Z`).getTime(); // wall-clock arithmetic only; Z here is just to get Date to parse it, timeZone below is what actually governs it
    const endDateTime = new Date(startMs + duration * 60000).toISOString().slice(0, 19);

    const contactLines = [
      tour.visitor_email ? `Email: ${tour.visitor_email}` : null,
      tour.visitor_phone ? `Phone: ${tour.visitor_phone}` : null,
      tour.guide_name ? `Guide: ${tour.guide_name}` : null,
    ].filter(Boolean).join("\n");

    const token = await getCalendarAccessToken();
    const eventRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Estate Tour with ${tour.visitor_name || "a Visitor"}`,
          description: contactLines || undefined,
          start: { dateTime: startDateTime, timeZone: TIME_ZONE },
          end: { dateTime: endDateTime, timeZone: TIME_ZONE },
          // organizer.email can't be changed to an identity this service
          // account doesn't control (Calendar silently keeps the real
          // one), but displayName is a friendly label Calendar does let
          // you override -- trying it here; the response below reports
          // back what Google actually assigned either way.
          organizer: { displayName: "North Star House" },
        }),
      },
    );
    if (!eventRes.ok) {
      const errText = await eventRes.text();
      return new Response(JSON.stringify({ error: `Calendar insert failed: ${eventRes.status} ${errText}` }), { status: 502 });
    }
    const event = await eventRes.json();

    await sbPatch(`estate_tours?id=eq.${encodeURIComponent(id)}`, { gcal_event_id: event.id });

    return new Response(JSON.stringify({ ok: true, eventId: event.id, organizer: event.organizer, creator: event.creator }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
