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

// ---------- confirmation email (same branded look as the other tour emails) ----------
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TIME_ZONE = 'America/Los_Angeles'
const WEBSITE_URL = 'https://www.northstarhouse.org'
const GOLD = '#886c44'
const TOUR_ADDRESS = '12075 Auburn Rd. Grass Valley, CA 95949'
const TOUR_DIRECTIONS_HTML_INLINE =
  `When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house for your tour.<br><br>` +
  `<strong>Apple Maps users:</strong> Make sure your directions are taking you to Auburn Road, not Allison Ranch Road — that route is incorrect and won't lead to the proper entrance. We have been working with Maps to correct this.<br><br>` +
  `Enter through the courtyard to arrive at the front door of the estate — your coordinator will meet you in this general area.`

const TOUR_DIRECTIONS_TEXT = `When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house for your tour.

Apple Maps users: Make sure your directions are taking you to Auburn Road, not Allison Ranch Road — that route is incorrect and won't lead to the proper entrance. We have been working with Maps to correct this.

Enter through the courtyard to arrive at the front door of the estate — your coordinator will meet you in this general area.`

const TOUR_EMAIL_FOOTER_LINKS = [
  { label: 'Website', url: `${WEBSITE_URL}/` },
  { label: 'Reschedule', url: 'mailto:info@northstarhouse.org?subject=Reschedule%20My%20Estate%20Tour' },
  { label: 'Directions', url: `${WEBSITE_URL}/directions-parking` },
]

function buildBrandedEmailHtml(opts: { headline: string; subtext: string; note?: string }) {
  const { headline, subtext, note } = opts
  const links = TOUR_EMAIL_FOOTER_LINKS
  const footerCells = links
    .map((l, i) => {
      const border = i < links.length - 1 ? 'border-right:1px solid #e5ddcf;' : ''
      return `<td style="width:${(100 / links.length).toFixed(2)}%;text-align:center;padding:14px 8px;${border}"><a href="${l.url}" style="color:${GOLD};text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:13px;">${l.label}</a></td>`
    })
    .join('')
  return (
    `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fdfbf7;border-radius:2px;overflow:hidden;">` +
    `<div style="height:14px;background:${GOLD};"></div>` +
    `<div style="padding:48px 40px 32px;text-align:center;">` +
    `<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${headline}</h1>` +
    `<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>` +
    `<p style="margin:0 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.5;text-align:left;">${subtext}</p>` +
    (note ? `<p style="margin:20px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>${note}</i></p>` : '') +
    `</div>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse;border-top:1px solid #e5ddcf;">` +
    `<tr>${footerCells}</tr>` +
    `</table>` +
    `</div>` +
    `</div>`
  )
}

function esc(s: string) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
}

function fmtWhen(date: string, time: string) {
  const d = new Date(`${date}T${time}`)
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  return `${day} at ${t}`
}

// Same rule as send-tour-reminders and the website's booking confirmation.
const DEFAULT_GUIDES_BY_WEEKDAY: Record<number, string> = { 1: 'Jen', 2: 'Jen', 4: 'Jen' } // 0 = Sunday
function tourGuideFor(date: string, guideName?: string | null) {
  const assigned = String(guideName || '').trim()
  if (assigned && assigned.toLowerCase() !== 'default') return assigned
  const d = new Date(`${date}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : DEFAULT_GUIDES_BY_WEEKDAY[d.getDay()] || ''
}

async function sendMail(to: string, subject: string, text: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Estate Tours · North Star House <info@northstarhouse.org>', to: [to], bcc: ['media@thenorthstarhouse.org'], subject, text, html }),
  })
  return res.ok
}


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
    const { id, date, start_time, guide_name, notify } = await req.json()
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
    const row = Array.isArray(updated) ? updated[0] : updated

    // Confirmation to the visitor (they asked for these dates, so they hear back as soon as it is scheduled).
    let emailed = false
    if (notify !== false && row && row.visitor_email) {
      const whenLong = fmtWhen(date, time)
      const guide = tourGuideFor(date, guide_name)
      const name = row.visitor_name || 'there'
      emailed = await sendMail(
        row.visitor_email,
        `Your North Star House tour is confirmed — ${whenLong}`,
        `Hi ${name},\n\nYour estate tour of North Star House is confirmed.\n\nTour Date & Time: ${whenLong}\n${guide ? `Your tour guide: ${guide}\n` : ''}Address: ${TOUR_ADDRESS}\n\n${TOUR_DIRECTIONS_TEXT}\n\nSee you then!\nNorth Star House`,
        buildBrandedEmailHtml({
          headline: 'Your Tour is Confirmed',
          subtext:
            `Hi ${esc(name)}, your estate tour of North Star House is confirmed:<br><br>` +
            `Tour Date &amp; Time: <strong>${esc(whenLong)}</strong><br>` +
            (guide ? `Your tour guide: <strong>${esc(guide)}</strong><br>` : '') +
            `Address: <strong>${esc(TOUR_ADDRESS)}</strong><br><br>` +
            TOUR_DIRECTIONS_HTML_INLINE,
          note: 'A reminder email will be sent to you 24 hours before the tour, and another 1-hour courtesy email the day of.',
        }),
      ).catch(() => false)
    }
    return json({ ok: true, row, emailed })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
