// Fetches the NSH Google Calendar's private ICS feed, parses it into the
// same event-object shape the client-side parser already produces (one
// object per VEVENT, keyed by iCal property name), and upserts the whole
// array into calendar_events_cache (a single row, id=1). Invoked every 15
// minutes by pg_cron -> pg_net -- server-side, so it never touches the
// browser/CORS path that's broken for Portal specifically. See
// add_calendar_events_cache.sql for why this exists instead of Portal
// calling an edge function directly.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CALENDAR_ICAL_URL = 'https://calendar.google.com/calendar/ical/thenorthstarhouse%40gmail.com/private-06287b2ca0d9ee6acd4f49f9d4d0d2da/basic.ics'

function parseIcs(text: string): Record<string, string>[] {
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
  const events: Record<string, string>[] = []
  let current: Record<string, string> | null = null
  for (const line of unfolded.split('\n')) {
    if (line === 'BEGIN:VEVENT') { current = {} }
    else if (line === 'END:VEVENT') { if (current) events.push(current); current = null }
    else if (current) {
      const ci = line.indexOf(':')
      if (ci !== -1) {
        const rawKey = line.slice(0, ci)
        const val = line.slice(ci + 1)
        const baseKey = rawKey.split(';')[0]
        current[baseKey] = val
      }
    }
  }
  return events
}

Deno.serve(async () => {
  try {
    const res = await fetch(CALENDAR_ICAL_URL)
    if (!res.ok) return new Response(JSON.stringify({ error: `Calendar fetch failed: HTTP ${res.status}` }), { status: 502 })
    const text = await res.text()
    const events = parseIcs(text)

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/calendar_events_cache`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ id: 1, events, updated_at: new Date().toISOString() }),
    })
    if (!upsertRes.ok) {
      const err = await upsertRes.text()
      return new Response(JSON.stringify({ error: `Upsert failed: ${err}` }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, count: events.length }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
