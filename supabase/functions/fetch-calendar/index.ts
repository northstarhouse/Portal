// Fetches the NSH Google Calendar's private ICS feed server-side and returns
// the raw text. Replaces a client-side call through corsproxy.io -- a free
// public CORS proxy with no uptime/rate-limit guarantees, which is why the
// Home dashboard's "Happening Soon" section (and the Venue Rentals wedding
// list) would silently go empty whenever that proxy was down or throttled.
// Fetching it here sidesteps CORS entirely (server-to-server, not
// browser-to-Google), so there's no third-party dependency in the loop.
//
// The URL below is the same one already shipped in the client bundle
// (src/app.jsx) -- moving it here doesn't change its exposure, just removes
// the flaky middleman.

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
