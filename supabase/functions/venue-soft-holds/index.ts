// Puts every Portal pre-booking on the North Star House Google Calendar as an all-day soft hold, and keeps it in step:
//   pre-booking submitted (agreement not signed yet)    -> "Soft hold: <name>"
//   agreement fully signed                              -> renamed to "<name>" (booked)
//   soft hold expired / declined, or submission deleted -> the calendar entry is removed
//   event date changed                                  -> the entry moves
// Bookings already on the calendar by hand (an entry that day sharing a name word) are left alone, never duplicated.
// HoneyBook imports and test clients are skipped. Tracked in venue_soft_holds. Runs every 15 minutes (pg_cron) and is
// idempotent; POST {} to run it now, {"dry_run":true} to see what it would do without touching the calendar.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
const CALENDAR_ID = "thenorthstarhouse@gmail.com";
const CAL = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
// The public "Event Booking Availability" calendar the website's date picker reads (all-day "Date Unavailable" entries).
const AVAIL_ID = "c_4c721bbe9e8a5ae57d4b008c1d6ab9e1ee81cf528c710937056eda71a22cfc93@group.calendar.google.com";
const AVAIL = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(AVAIL_ID)}/events`;
// Main-calendar entries that hold the venue for a booking (by title), and titles that never do.
const BOOKING_TITLE = /wedding|private|party|soft hold|bat mitzva|bar mitzva|memorial|celebration|reception|rehearsal|non-?profit|fundraiser|gala|\bevent\b/i;
const NOT_BOOKING = /tour|walk.?through|meeting|dumpster|mahjong|\bdue\b|reflection|decorating|mixer|trivia|speaker|residency|magic|open house|presentation|class|workshop|volunteer|clean.?up|board|committee/i;

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Supabase ${init.method || "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

// ---------- Google service-account auth (same flow as add-tour-to-calendar) ----------

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
  const enc = new TextEncoder();
  const signingInput = `${base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))}.${base64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/calendar.events", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
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

async function gcal(method: string, path: string, body?: unknown, base = CAL) {
  const token = await getCalendarAccessToken();
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (method === "DELETE" && (r.status === 404 || r.status === 410)) return null;
  if (!r.ok) throw new Error(`Calendar ${method} failed: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

const nextDay = (d: string) => new Date(Date.parse(d + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
const GENERIC = new Set(["wedding", "party", "event", "private", "public", "soft", "hold", "rehearsal", "inquiry", "with"]);
const words = (s: string) => String(s || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const laDay = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }) : "";
const phoneFmt = (p: unknown) => { const d = String(p || "").replace(/[^0-9]/g, "").replace(/^1(?=[0-9]{10}$)/, ""); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || "").trim(); };
const clean = (x: unknown) => String(x ?? "").trim();

// The calendar entry's notes: who the clients are and where the booking stands, rebuilt whenever any of it changes.
function describe(inq: any, form: any, v: any, signers: any[]): string {
  const a = form?.answers || {};
  const status = v?.status || null;
  const lines: string[] = [];
  if (status === "completed") lines.push(`BOOKED · agreement fully signed ${laDay(v.completed_at)}`);
  else {
    lines.push(`SOFT HOLD · pre-booking form received ${laDay(form?.created_at || inq.created_at)}`);
    lines.push(status === "pending" ? `Agreement sent ${laDay(v.issued_at)}, waiting for signatures${v.expires_at ? ` (sign by ${laDay(v.expires_at)} or the hold is released)` : ""}`
      : status === "draft" ? "Agreement drafted, not sent yet" : status === "void" || status === "superseded" ? "Agreement being revised" : "Agreement not created yet");
  }
  const guests = clean(a.max_guests || inq.guest_count);
  lines.push([clean(inq.event_type || a.__event_type), guests ? `up to ${guests} guests` : ""].filter(Boolean).join(" · "));
  lines.push("", "Clients");
  const people = signers.filter((x) => x.role !== "venue").map((x) => ({ name: clean(x.name), email: clean(x.email), signed: x.status === "signed" ? laDay(x.signed_at) : "" }));
  if (!people.length) {
    const p1 = clean(a["7fnabd0i"] || a.evp_name || inq.name), p2 = clean(a["7leui2ic"] || inq.partner_name);
    people.push({ name: p1, email: clean(a.c9u1sxb4 || a.evp_email || inq.email), signed: "" });
    if (p2) people.push({ name: p2, email: clean(a.pt4mail1), signed: "" });
  }
  for (const x of people) lines.push([x.name, x.email.toLowerCase(), x.signed ? `signed ${x.signed}` : ""].filter(Boolean).join(" · "));
  if (clean(a.evp_org)) lines.push(`Organization: ${clean(a.evp_org)}`);
  const phones = [...new Set([a["163otrai"], a.pt4phon1, a.evp_phone, inq.phone].map(phoneFmt).filter(Boolean))];
  if (phones.length) lines.push(`Phone: ${phones.join(" / ")}`);
  const m = String(inq.event_date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) lines.push("", `Venue code: ${MONTHS[+m[2] - 1]}-${m[3]}-${m[1]}`);
  lines.push("Kept up to date automatically from the Portal.");
  return lines.join("\n");
}
const NOTE = "Added automatically from the Portal pre-booking form. Renamed when the agreement is fully signed; removed if the soft hold is released or the submission is deleted.";
const allDay = (date: string) => ({ start: { date }, end: { date: nextDay(date) } });

const AUTO_TAG = "Blocked automatically: booked or soft-held on the North Star House calendar.";
// Days an ICS-cache entry covers (all-day entries span to DTEND; timed ones count their start day).
function icsDays(e: any): string[] {
  const st = String(e.DTSTART || ""), en = String(e.DTEND || "");
  if (!/^\d{8}/.test(st)) return [];
  const iso = (x: string) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`;
  const first = iso(st);
  if (st.length !== 8 || !/^\d{8}$/.test(en)) return [first];
  const out: string[] = [];
  for (let d = first; d < iso(en) && out.length < 14; d = nextDay(d)) out.push(d);
  return out.length ? out : [first];
}
// Days an availability-calendar event (Calendar API shape) covers.
function evDays(ev: any): string[] {
  if (ev.start?.date) { const out: string[] = []; for (let d = ev.start.date; d < (ev.end?.date || nextDay(ev.start.date)) && out.length < 60; d = nextDay(d)) out.push(d); return out.length ? out : [ev.start.date]; }
  const t = ev.start?.dateTime ? new Date(new Date(ev.start.dateTime).getTime() - 8 * 3600000).toISOString().slice(0, 10) : null;
  return t ? [t] : [];
}

// Calendar entries already on that date (from the 15-minute ICS cache), for the "already on the calendar by hand" check.
function entriesOn(cache: any[], date: string): string[] {
  const d = date.replace(/-/g, "");
  return cache.filter((e) => String(e.DTSTART || "").slice(0, 8) === d).map((e) => String(e.SUMMARY || ""));
}

Deno.serve(async (req) => {
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dry = body?.dry_run === true;
    const today = new Date(Date.now() - 8 * 3600000).toISOString().slice(0, 10);
    const inqs: any[] = await rest(`venue_inquiries?select=id,name,email,phone,partner_name,event_type,guest_count,event_date,status,prebooking_form_response_id&prebooking_form_response_id=not.is.null&status=neq.HoneyBook%20Imported`);
    const respIds = [...new Set(inqs.map((i) => i.prebooking_form_response_id))];
    let forms: any[] = [];
    const live = new Set<string>(respIds.length ? (forms = await rest(`nsh_form_responses?select=id,created_at,answers&id=in.(${respIds.join(",")})`)).map((r: any) => r.id) : []);
    const versions: any[] = respIds.length ? await rest(`venue_agreement_versions?select=id,response_id,version,status,issued_at,expires_at,completed_at&response_id=in.(${respIds.join(",")})&order=version.desc`) : [];
    const latestIds = respIds.map((r) => versions.find((v) => v.response_id === r)?.id).filter(Boolean);
    const signers: any[] = latestIds.length ? await rest(`venue_agreement_signers?select=version_id,name,email,role,status,signed_at&version_id=in.(${latestIds.join(",")})`) : [];
    const holds: any[] = await rest(`venue_soft_holds?select=*`);
    const cacheRow = (await rest(`calendar_events_cache?select=events&id=eq.1`))?.[0];
    const cache: any[] = Array.isArray(cacheRow?.events) ? cacheRow.events : [];
    const out: any[] = [];
    const stamp = () => new Date().toISOString();

    // What each pre-booking should look like on the calendar (null = no entry).
    const want = new Map<string, { date: string; summary: string; name: string; details: string } | null>();
    for (const i of inqs) {
      const rid = i.prebooking_form_response_id;
      if (!live.has(rid) || !i.event_date || /\btest\b/i.test(i.name || "")) continue;
      const v = versions.find((x) => x.response_id === rid) || null;
      const ag = v?.status || null;
      const name = String(i.name || "Venue booking").trim();
      const details = describe(i, forms.find((f) => f.id === rid), v, signers.filter((x) => x.version_id === v?.id));
      want.set(rid, ag === "expired" || ag === "declined" ? null : { date: i.event_date, name, details, summary: ag === "completed" ? name : `Soft hold: ${name}` });
    }

    for (const [rid, w] of want) {
      const h = holds.find((x) => x.response_id === rid);
      if (!w) {
        if (h?.gcal_event_id && h.state === "active") {
          if (!dry) {
            await gcal("DELETE", "/" + encodeURIComponent(h.gcal_event_id));
            await rest(`venue_soft_holds?response_id=eq.${rid}`, { method: "PATCH", body: JSON.stringify({ state: "released", gcal_event_id: null, updated_at: stamp() }) });
          }
          out.push({ released: h.summary });
        }
        continue;
      }
      if (h?.state === "existing") continue;
      // Another run is creating this one right now (triggers can fire close together); a claim older than 10 minutes is stale.
      if (h?.state === "creating" && Date.now() - Date.parse(h.updated_at) < 600000) continue;
      if (!h || h.state === "released" || h.state === "creating" || !h.gcal_event_id) {
        if (w.date < today) continue;
        if (!h) {
          const own = words(w.name);
          const manual = entriesOn(cache, w.date).find((s) => !/^soft hold: /i.test(s) && words(s).some((x) => own.includes(x)));
          if (manual) {
            if (!dry) await rest(`venue_soft_holds?on_conflict=response_id`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ response_id: rid, event_date: w.date, summary: manual, state: "existing" }) });
            out.push({ already_on_calendar: manual, date: w.date });
            continue;
          }
        }
        if (!dry) {
          // Claim the row first so two overlapping runs can never both create a calendar entry for the same booking.
          const claim = { event_date: w.date, summary: w.summary, state: "creating", updated_at: stamp() };
          const got: any[] = !h
            ? await rest(`venue_soft_holds?on_conflict=response_id`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ response_id: rid, ...claim }) })
            : await rest(`venue_soft_holds?response_id=eq.${rid}&updated_at=eq.${encodeURIComponent(h.updated_at)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(claim) });
          if (!got?.length) continue;
          try {
            const ev = await gcal("POST", "", { summary: w.summary, description: w.details, ...allDay(w.date), transparency: "transparent" });
            await rest(`venue_soft_holds?response_id=eq.${rid}`, { method: "PATCH", body: JSON.stringify({ gcal_event_id: ev.id, details: w.details, state: "active", updated_at: stamp() }) });
          } catch (e) {
            await rest(`venue_soft_holds?response_id=eq.${rid}`, { method: "PATCH", body: JSON.stringify({ state: "released", gcal_event_id: null, updated_at: stamp() }) }).catch(() => {});
            throw e;
          }
        }
        out.push({ created: w.summary, date: w.date });
        continue;
      }
      if (h.summary !== w.summary || h.event_date !== w.date || h.details !== w.details) {
        if (!dry) {
          await gcal("PATCH", "/" + encodeURIComponent(h.gcal_event_id), { summary: w.summary, description: w.details, ...allDay(w.date) });
          await rest(`venue_soft_holds?response_id=eq.${rid}`, { method: "PATCH", body: JSON.stringify({ event_date: w.date, summary: w.summary, details: w.details, updated_at: stamp() }) });
        }
        out.push({ updated: w.summary, date: w.date });
      }
    }

    // Submissions deleted from the Portal (or turned into test/HoneyBook records): take their upcoming holds off the calendar.
    for (const h of holds) {
      if (want.has(h.response_id) || h.state !== "active" || !h.gcal_event_id || h.event_date < today) continue;
      if (!dry) {
        await gcal("DELETE", "/" + encodeURIComponent(h.gcal_event_id));
        await rest(`venue_soft_holds?response_id=eq.${h.response_id}`, { method: "DELETE" });
      }
      out.push({ removed: h.summary });
    }

    // ---- Website availability: every booked / soft-held date on the main calendar (plus Portal pre-bookings) is blocked on
    // the public availability calendar. Only adds blocks, and only removes the ones this sync added (marked in their
    // description) once nothing on the main calendar holds that date any more. Blocks staff added by hand are never touched.
    const avail: any = { added: [], removed: [] };
    try {
      const held = new Set<string>();
      for (const e of cache) {
        const t = String(e.SUMMARY || "");
        if (String(e.STATUS || "").toUpperCase() === "CANCELLED" || !BOOKING_TITLE.test(t) || NOT_BOOKING.test(t)) continue;
        for (const d of icsDays(e)) if (d >= today) held.add(d);
      }
      for (const [, w] of want) if (w && w.date >= today) held.add(w.date);
      // The website's booking-availability function merges these dates in directly, so the site is right even when the
      // availability calendar can't be written to (Workspace sharing limits outside accounts to view-only).
      avail.held = held.size;
      if (!dry) await rest(`site_content?on_conflict=page_key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ page_key: "bookingHeldDates", content: { dates: [...held].sort(), syncedAt: stamp() } }) });
      const existing: any[] = [];
      let pageToken = "";
      do {
        const page = await gcal("GET", `?singleEvents=true&maxResults=2500&timeMin=${today}T00:00:00Z${pageToken ? "&pageToken=" + pageToken : ""}`, undefined, AVAIL);
        existing.push(...(page.items || []));
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      const blocked = new Set<string>();
      for (const ev of existing) for (const d of evDays(ev)) blocked.add(d);
      const mine = existing.filter((ev) => String(ev.description || "").includes(AUTO_TAG));
      for (const d of [...held].sort()) {
        if (blocked.has(d)) continue;
        if (!dry) await gcal("POST", "", { summary: "Date Unavailable", description: AUTO_TAG, start: { date: d }, end: { date: nextDay(d) }, transparency: "transparent" }, AVAIL);
        avail.added.push(d);
      }
      for (const ev of mine) {
        const d = ev.start?.date;
        if (!d || d < today || held.has(d)) continue;
        if (!dry) await gcal("DELETE", "/" + encodeURIComponent(ev.id), undefined, AVAIL);
        avail.removed.push(d);
      }
      if (!dry && (avail.added.length || avail.removed.length)) {
        const all = [...new Set([...blocked, ...avail.added].filter((d) => !avail.removed.includes(d)))].sort();
        await rest(`site_content?page_key=eq.bookingAvailability`, { method: "PATCH", body: JSON.stringify({ content: { bookedDates: all, syncedAt: stamp() } }) }).catch(() => {});
      }
    } catch (e) { avail.error = String(e); }

    if (!dry && out.some((o) => !o.already_on_calendar)) fetch(`${SUPABASE_URL}/functions/v1/refresh-calendar-cache`, { method: "POST", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }).catch(() => {});
    return new Response(JSON.stringify({ ok: true, dry_run: dry, changes: out, availability: avail }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
