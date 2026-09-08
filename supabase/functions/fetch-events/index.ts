// Identical to fetch-calendar -- renamed because a real browser reported a
// CORS error hitting /functions/v1/fetch-calendar consistently (even in
// incognito, ruling out extensions) while every direct/curl test of that
// same URL came back clean with correct CORS headers. That mismatch (real
// browser rejects it, nothing else does) points at a network-level filter
// intercepting requests whose path contains "calendar" -- common in
// router/ISP/security-software content filters that target calendar
// embeds -- and substituting its own response, which naturally lacks
// Supabase's CORS headers. Renaming sidesteps that pattern match instead
// of trying to prove/disprove it further.
//
// See fetch-calendar/index.ts for the original; that one is left in place
// in case this turns out not to be the cause.

const CALENDAR_ICAL_URL = "https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const res = await fetch(CALENDAR_ICAL_URL);
    if (!res.ok) {
      return new Response(`Calendar fetch failed: HTTP ${res.status}`, {
        status: 502,
        headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
      });
    }
    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/calendar; charset=utf-8", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(`Calendar fetch error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 502,
      headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
    });
  }
});
