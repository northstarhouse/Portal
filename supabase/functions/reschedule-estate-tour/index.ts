// Reschedules one booked estate tour: saves the new date/time, moves its
// Google Calendar event, and (unless notify is false) emails the visitor
// the new time. Called by the Portal's "Reschedule" buttons.
//
// Before this existed the Portal PATCHed the row directly, which left the
// calendar event at the old time (add-tour-to-calendar only ever creates,
// and skips rows that already have a gcal_event_id) and never told the
// visitor.
//
// Clearing reminder_*_sent_at lets the normal 24h / 1h reminders go out for
// the new time. They're computed from the row's current date, so nothing is
// ever sent for the old one.
//
// The calendar move is best-effort: the row is the source of truth, so a
// Calendar API failure doesn't fail the reschedule. The response reports it.
//
// POST body: { id: uuid, date: 'YYYY-MM-DD', start_time: 'HH:MM[:SS]', notify?: boolean }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
const CALENDAR_ID = 'thenorthstarhouse@gmail.com'
const TIME_ZONE = 'America/Los_Angeles'
const WEBSITE_URL = 'https://www.northstarhouse.org'
const GOLD = '#886c44'
const TOUR_ADDRESS = '12075 Auburn Rd. Grass Valley, CA 95949'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// ---------- email (same template + wording as send-tour-reminders) ----------

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

// Email headlines: capitalise each word, keeping small words (a, of, the, for...) lowercase unless first or last.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'up', 'as', 'vs'])
function titleCase(t: string): string {
  if (/[<&]/.test(t)) return t
  const w = String(t).split(' ')
  return w.map((x, i) => (!x || (i > 0 && i < w.length - 1 && SMALL_WORDS.has(x.toLowerCase())) ? x : x.charAt(0).toUpperCase() + x.slice(1))).join(' ')
}

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
    `<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${titleCase(headline)}</h1>` +
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

// ---------- Supabase ----------

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

// ---------- Google Calendar (same service-account flow as add-tour-to-calendar) ----------

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let str = ''
  for (const b of arr) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function getCalendarAccessToken(): Promise<string> {
  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY!)
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)))
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)))
  const signingInput = `${encHeader}.${encClaims}`
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${base64url(signature)}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

// Moves the event to the new slot, or creates one if the tour never got an
// event. Returns a short status for the Portal.
async function syncCalendar(id: string, eventId: string | null, date: string, time: string, duration: number): Promise<string> {
  if (!eventId) {
    const r = await sb('/functions/v1/add-tour-to-calendar', { method: 'POST', body: JSON.stringify({ id }) })
    return r.ok ? 'created' : `create failed (${r.status})`
  }
  if (!GOOGLE_SERVICE_ACCOUNT_KEY) return 'not configured'
  const startMs = new Date(`${date}T${time}Z`).getTime() // wall-clock arithmetic only; timeZone below governs it
  const token = await getCalendarAccessToken()
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { dateTime: `${date}T${time}`, timeZone: TIME_ZONE },
        end: { dateTime: new Date(startMs + duration * 60000).toISOString().slice(0, 19), timeZone: TIME_ZONE },
      }),
    },
  )
  if (r.ok) {
    fetch(`${SUPABASE_URL}/functions/v1/refresh-calendar-cache`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }).catch(() => {})
    return 'moved'
  }
  // Event deleted by hand in Google Calendar: forget it and make a new one.
  if (r.status === 404 || r.status === 410) {
    await sb(`/rest/v1/estate_tours?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ gcal_event_id: null }) })
    return syncCalendar(id, null, date, time, duration)
  }
  return `move failed (${r.status})`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)
    const { id, date, start_time, notify } = await req.json()
    if (!id || typeof id !== 'string') return jsonResponse({ error: 'id required' }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return jsonResponse({ error: 'date must be YYYY-MM-DD' }, 400)
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(start_time || '')) return jsonResponse({ error: 'start_time must be HH:MM' }, 400)
    const time = start_time.length === 5 ? `${start_time}:00` : start_time

    const rows = await sb(`/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}&select=*`).then((r) => r.json())
    const tour = Array.isArray(rows) ? rows[0] : null
    if (!tour) return jsonResponse({ error: 'No tour with that id' }, 404)

    const changed = tour.date !== date || String(tour.start_time || '').slice(0, 8) !== time

    // A guide has one row per time slot (unique on date + start_time). If the target time is an
    // empty "open" slot, this tour takes it over; anything else at that time is a real conflict.
    let takenOverSlot: any = null
    if (changed && tour.guide_name) {
      const clashRes = await sb(
        `/rest/v1/estate_tours?date=eq.${date}&start_time=eq.${time}&guide_name=eq.${encodeURIComponent(tour.guide_name)}&id=neq.${encodeURIComponent(id)}&select=*`,
      )
      const clash = clashRes.ok ? await clashRes.json() : []
      if (Array.isArray(clash) && clash.length) {
        const c = clash[0]
        if (c.status === 'open') {
          const del = await sb(`/rest/v1/estate_tours?id=eq.${c.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
          if (!del.ok) return jsonResponse({ error: `Could not free that time slot: ${await del.text()}` }, 500)
          takenOverSlot = c
        } else if (c.status === 'blocked') {
          return jsonResponse({ error: `${fmtWhen(date, time)} is blocked on ${tour.guide_name}'s schedule. Unblock it first, or pick another time.` }, 409)
        } else {
          return jsonResponse({ error: `${fmtWhen(date, time)} is already ${c.status === 'booked' ? 'booked' + (c.visitor_name ? ' by ' + c.visitor_name : '') : 'taken (' + c.status + ')'}. Pick another time.` }, 409)
        }
      }
    }

    const up = await sb(`/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ date, start_time: time, reminder_24h_sent_at: null, reminder_1h_sent_at: null }),
    })
    if (!up.ok) {
      const err = await up.text()
      // Put the empty slot back if we freed it and the move didn't happen.
      if (takenOverSlot) await sb('/rest/v1/estate_tours', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(takenOverSlot) }).catch(() => {})
      return jsonResponse({ error: `Could not save: ${err}` }, 500)
    }
    if (!changed) {
      // Nothing moved. If staff asked to notify, send the visitor a confirmation of the booking as it stands
      // (this is how a booking that never got its confirmation email gets one).
      let emailedSame = false
      if (notify !== false && tour.status === 'booked' && tour.visitor_email) {
        const when = fmtWhen(date, time)
        const guide = tourGuideFor(date, tour.guide_name)
        const name = tour.visitor_name || 'there'
        emailedSame = await sendMail(
          tour.visitor_email,
          `Your North Star House tour is confirmed — ${when}`,
          `Hi ${name},\n\nYour estate tour of North Star House is confirmed.\n\nTour Date & Time: ${when}\n${guide ? `Your tour guide: ${guide}\n` : ''}Address: ${TOUR_ADDRESS}\n\n${TOUR_DIRECTIONS_TEXT}\n\nSee you then!\nNorth Star House`,
          buildBrandedEmailHtml({
            headline: 'Your Tour is Confirmed',
            subtext:
              `Hi ${esc(name)}, your estate tour of North Star House is confirmed:<br><br>` +
              `Tour Date &amp; Time: <strong>${esc(when)}</strong><br>` +
              (guide ? `Your tour guide: <strong>${esc(guide)}</strong><br>` : '') +
              `Address: <strong>${esc(TOUR_ADDRESS)}</strong><br><br>` +
              TOUR_DIRECTIONS_HTML_INLINE,
            note: 'A reminder email will be sent to you 24 hours before the tour, and another 1-hour courtesy email the day of.',
          }),
        )
      }
      return jsonResponse({ ok: true, unchanged: true, emailed: emailedSame })
    }
    // The time this tour left is an open slot again; recreate the standard open slots now rather than at the nightly run.
    await sb('/rest/v1/rpc/ensure_default_tour_slots', { method: 'POST', body: '{}' }).catch(() => {})

    let calendar = 'skipped'
    if (tour.status === 'booked') {
      try {
        calendar = await syncCalendar(id, tour.gcal_event_id, date, time, tour.duration_min || 45)
      } catch (e) {
        calendar = `failed: ${String(e).slice(0, 120)}`
      }
    }

    let emailed = false
    if (notify !== false && tour.status === 'booked' && tour.visitor_email) {
      const when = fmtWhen(date, time)
      const oldWhen = tour.date && tour.start_time ? fmtWhen(tour.date, tour.start_time) : ''
      const guide = tourGuideFor(date, tour.guide_name)
      const name = tour.visitor_name || 'there'
      const note = 'A reminder email will be sent to you 24 hours before the tour, and another 1-hour courtesy email the day of.'
      emailed = await sendMail(
        tour.visitor_email,
        `Your North Star House tour has been rescheduled — ${when}`,
        `Hi ${name},\n\nYour estate tour of North Star House has been rescheduled.\n\nNew Tour Date & Time: ${when}\n${oldWhen ? `(Previously ${oldWhen})\n` : ''}${guide ? `Your tour guide: ${guide}\n` : ''}Address: ${TOUR_ADDRESS}\n\n${TOUR_DIRECTIONS_TEXT}\n\n${note}\n\nNorth Star House`,
        buildBrandedEmailHtml({
          headline: 'Your Tour Has Been Rescheduled',
          subtext:
            `Hi ${esc(name)}, your estate tour of North Star House has been rescheduled.<br><br>` +
            `New Tour Date &amp; Time: <strong>${esc(when)}</strong><br>` +
            (oldWhen ? `<span style="color:#888;">(Previously ${esc(oldWhen)})</span><br>` : '') +
            (guide ? `Your tour guide: <strong>${esc(guide)}</strong><br>` : '') +
            `Address: <strong>${esc(TOUR_ADDRESS)}</strong><br><br>` +
            TOUR_DIRECTIONS_HTML_INLINE,
          note,
        }),
      )
    }

    return jsonResponse({ ok: true, calendar, emailed })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
