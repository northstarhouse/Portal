// Books a tour REQUEST (estate_tours.status = 'requested') onto a real date/time with a guide.
// Called by the Portal's "+ Add to Calendar" panel on Venue Rentals > Tour Requests.
//
// Marking the row 'booked' is what puts it on the Google Calendar (the
// estate_tour_booked_sync_calendar trigger -> add-tour-to-calendar), moves it into Upcoming
// Tours and onto the automatic reminder emails.
//
// A guide has one row per time slot (unique on date + start_time for Jen). If the chosen time
// is an empty "open" slot, this request takes it over; a blocked or already-booked time is a
// real conflict and is refused with a plain message. The browser can't delete rows (RLS), so
// this runs with the service role.
//
// POST body: { id: uuid, date: 'YYYY-MM-DD', start_time: 'HH:MM[:SS]', guide_name: 'Jen' | 'Derek' }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GUIDES = ['Jen', 'Derek']
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const sb = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })

function when(date: string, time: string) {
  const d = new Date(`${date}T${time}`)
  if (Number.isNaN(d.getTime())) return `${date} ${time}`
  return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    const { id, date, start_time, guide_name } = await req.json()
    if (!id || typeof id !== 'string') return json({ error: 'id required' }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return json({ error: 'date must be YYYY-MM-DD' }, 400)
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(start_time || '')) return json({ error: 'start_time must be HH:MM' }, 400)
    if (!GUIDES.includes(guide_name)) return json({ error: 'Choose a guide: Jen or Derek.' }, 400)
    const time = start_time.length === 5 ? `${start_time}:00` : start_time

    const rows = await sb(`/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}&select=*`).then((r) => r.json())
    const tour = Array.isArray(rows) ? rows[0] : null
    if (!tour) return json({ error: 'No tour request with that id' }, 404)
    if (tour.status === 'booked') return json({ error: 'This tour is already booked.' }, 409)
    if (tour.status !== 'requested') return json({ error: `This is not an open request (status: ${tour.status}).` }, 409)

    // Same guide, same time: an open slot is taken over, anything else is a conflict.
    let freedSlot: any = null
    const clashRes = await sb(
      `/rest/v1/estate_tours?date=eq.${date}&start_time=eq.${time}&guide_name=eq.${encodeURIComponent(guide_name)}&id=neq.${encodeURIComponent(id)}&select=*`,
    )
    const clash = clashRes.ok ? await clashRes.json() : []
    if (Array.isArray(clash) && clash.length) {
      const c = clash[0]
      if (c.status === 'open') {
        const del = await sb(`/rest/v1/estate_tours?id=eq.${c.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        if (!del.ok) return json({ error: `Could not free that time slot: ${await del.text()}` }, 500)
        freedSlot = c
      } else if (c.status === 'blocked') {
        return json({ error: `${when(date, time)} is blocked on ${guide_name}'s schedule. Unblock it first, or pick another time.` }, 409)
      } else {
        return json({ error: `${when(date, time)} is already ${c.status === 'booked' ? 'booked' + (c.visitor_name ? ' by ' + c.visitor_name : '') : 'taken (' + c.status + ')'} with ${guide_name}. Pick another time or guide.` }, 409)
      }
    }

    const up = await sb(`/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ date, start_time: time, guide_name, status: 'booked', request_handled: true, reminder_24h_sent_at: null, reminder_1h_sent_at: null }),
    })
    if (!up.ok) {
      const err = await up.text()
      // Put the empty slot back if we freed it and the booking didn't happen.
      if (freedSlot) await sb('/rest/v1/estate_tours', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(freedSlot) }).catch(() => {})
      return json({ error: `Could not book this tour: ${err}` }, 500)
    }
    const updated = await up.json()
    // Recreate the standard open slots now (covers any default slot this request displaced).
    await sb('/rest/v1/rpc/ensure_default_tour_slots', { method: 'POST', body: '{}' }).catch(() => {})
    return json({ ok: true, row: Array.isArray(updated) ? updated[0] : updated })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
