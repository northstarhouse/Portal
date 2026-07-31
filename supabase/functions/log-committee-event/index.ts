// Called from the (unauthenticated) Events Committee app whenever an event is
// added or renamed there. That app has no Portal session token, so it can't
// write to "In-House Events" directly (RLS requires has_valid_app_session())
// — this function does it server-side with the service role key instead, and
// also logs the change to activity_log so it shows up in Recent Activity.
//
// POST body (create): { name: string, date: string, cost?: number, link?: string, skipActivityLog?: boolean }
// POST body (update, keeps the two records' names/dates in sync — the
// committee app is the source of truth): { ihEventId: number, name: string, date: string, skipActivityLog?: boolean }
//
// skipActivityLog: callers that can log a better-attributed entry themselves
// (e.g. Volunteer Hub, which knows the signed-in volunteer's name) pass this
// so the activity feed doesn't get a duplicate generic entry alongside theirs.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const sbHeaders = (extra?: Record<string, string>) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

  try {
    const { name, date, cost, link, ihEventId, skipActivityLog } = await req.json();
    if (!name || !date) return json({ error: "name and date are required" }, 400);

    if (ihEventId) {
      // Update path: keep the linked In-House Events row's name/date in sync.
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent("In-House Events")}?id=eq.${ihEventId}`, {
        method: "PATCH",
        headers: sbHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify({ name, date }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(`In-House Events update failed: ${patchRes.status} ${JSON.stringify(patchData)}`);

      if (!skipActivityLog) {
        await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
          method: "POST",
          headers: sbHeaders({ Prefer: "return=minimal" }),
          body: JSON.stringify({
            description: "Events Committee event renamed/rescheduled: " + name,
            action: "committee_event_updated",
            tag: "Event",
          }),
        }).catch(() => {});
      }

      return json({ success: true, event: Array.isArray(patchData) ? patchData[0] : patchData });
    }

    const iheRes = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent("In-House Events")}`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({ name, date, cost: cost || null, link: link || null }),
    });
    const iheData = await iheRes.json();
    if (!iheRes.ok) throw new Error(`In-House Events insert failed: ${iheRes.status} ${JSON.stringify(iheData)}`);

    if (!skipActivityLog) {
      await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
        method: "POST",
        headers: sbHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify({
          description: "New event added to the Events Committee planning notes: " + name,
          action: "committee_event_added",
          tag: "Event",
        }),
      }).catch(() => {});
    }

    return json({ success: true, event: Array.isArray(iheData) ? iheData[0] : iheData });
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
