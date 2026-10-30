// Cancels one booked estate tour (or tour request): removes its Google Calendar event, optionally emails the
// visitor a branded cancellation, and either puts the time back as an open slot (future tours) or marks the
// row cancelled (past tours / requests). Called by the Portal's "Cancel Tour" button.
//
// The row is the source of truth: a calendar or email problem doesn't stop the cancellation, the response
// just reports it.
//
// POST body: { id: uuid, notify?: boolean }   (notify defaults to true when the visitor has an email)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
const CALENDAR_ID = 'thenorthstarhouse@gmail.com'
const WEBSITE_URL = 'https://www.northstarhouse.org'
const WEDDING_FORM_ID = '1eea2137-f94d-414b-a977-4ed622214580'
const GOLD = '#886c44'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const esc = (s: string) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

function fmtWhen(date: string, time: string) {
  const d = new Date(`${date}T${time}`)
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  return `${day} at ${t}`
}

// Email headlines: capitalise each word, keeping small words (a, of, the, for...) lowercase unless first or last.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'up', 'as', 'vs'])
function titleCase(t: string): string {
  if (/[<&]/.test(t)) return t
  const w = String(t).split(' ')
  return w.map((x, i) => (!x || (i > 0 && i < w.length - 1 && SMALL_WORDS.has(x.toLowerCase())) ? x : x.charAt(0).toUpperCase() + x.slice(1))).join(' ')
}

// Same look as the tour confirmation / reschedule emails, with a button to book another time.
function buildEmailHtml(headline: string, subtext: string, buttonUrl: string, buttonText: string) {
  return (
    `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;">` +
    `<div style="height:14px;background:${GOLD};"></div>` +
    `<div style="padding:44px 40px 36px;text-align:center;">` +
    `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:${GOLD};font-weight:bold;margin-bottom:14px;">NORTH STAR HOUSE</div>` +
    `<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${titleCase(headline)}</h1>` +
    `<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>` +
    `<p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">${subtext}</p>` +
    `<a href="${buttonUrl}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:16px 32px;">${buttonText}</a>` +
    `<p style="margin:22px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email.</i></p>` +
    `</div></div></div>`
  )
}

async function sendMail(to: string, subject: string, text: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Estate Tours · North Star House <info@northstarhouse.org>', to: [to], bcc: ['media@thenorthstarhouse.org'], subject, text, html }),
  })
  return res.ok
}

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

// ---------- Google Calendar (same service-account flow as the other tour functions) ----------
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
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })))
  const signingInput = `${encHeader}.${encClaims}`
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${signingInput}.${base64url(signature)}`,
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`)
  return (await res.json()).access_token
}
async function deleteCalendarEvent(eventId: string): Promise<string> {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY) return 'not configured'
  const token = await getCalendarAccessToken()
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (r.ok || r.status === 404 || r.status === 410) {
    fetch(`${SUPABASE_URL}/functions/v1/refresh-calendar-cache`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }).catch(() => {})
    return 'removed'
  }
  return `failed (${r.status})`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)
    const { id, notify } = await req.json()
    if (!id || typeof id !== 'string') return jsonResponse({ error: 'id required' }, 400)

    const rows = await sb(`/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}&select=*`).then((r) => r.json())
    const tour = Array.isArray(rows) ? rows[0] : null
    if (!tour) return jsonResponse({ error: 'No tour with that id' }, 404)
    if (tour.status !== 'booked' && tour.status !== 'requested') return jsonResponse({ error: `This tour is already ${tour.status}.` }, 409)

    // Calendar first (best-effort).
    let calendar = 'skipped'
    if (tour.gcal_event_id) {
      try { calendar = await deleteCalendarEvent(tour.gcal_event_id) } catch (e) { calendar = `failed: ${String(e).slice(0, 100)}` }
    }

    // Visitor email (only for a booked tour with a time).
    let emailed = false
    const canEmail = tour.status === 'booked' && tour.visitor_email && tour.date && tour.start_time
    if (notify !== false && canEmail) {
      const when = fmtWhen(tour.date, String(tour.start_time))
      const name = tour.visitor_name || 'there'
      const wedding = tour.inquiry_form_id === WEDDING_FORM_ID || /wedding/i.test(String(tour.category || ''))
      const rebook = wedding ? `${WEBSITE_URL}/weddings#inquiry` : `${WEBSITE_URL}/`
      emailed = await sendMail(
        tour.visitor_email,
        `Your North Star House tour on ${when} has been cancelled`,
        `Hi ${name},\n\nAs you requested, your estate tour of North Star House scheduled for ${when} has been cancelled.\n\nWhenever you'd like to visit, you can pick a new time here: ${rebook}\n\nOr just reply to this email and we'll find a time together.\n\nNorth Star House`,
        buildEmailHtml(
          'Your Tour Has Been Cancelled',
          `Hi ${esc(name)}, as you requested, your estate tour of North Star House scheduled for <strong>${esc(when)}</strong> has been cancelled.<br><br>Whenever you'd like to visit, you can pick a new time below, or just reply to this email and we'll find a time together.`,
          rebook,
          wedding ? 'Book Another Tour' : 'Visit Our Website',
        ),
      )
    }

    // Record it, then free the row. A future booked tour goes back to being an open slot (the unique
    // date+time rule means the same row is reused); a past tour or a request is marked cancelled.
    const todayPT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    await sb('/rest/v1/activity_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        description: `Tour cancelled: ${tour.visitor_name || 'Visitor'}${tour.date ? ' — ' + fmtWhen(tour.date, String(tour.start_time || '00:00:00')) : ''}`,
        action: 'tour_cancelled',
        tag: 'Tour',
        detail: { tour_id: tour.id, date: tour.date, start_time: tour.start_time, guide_name: tour.guide_name, visitor_email: tour.visitor_email, visitor_phone: tour.visitor_phone, emailed },
      }),
    }).catch(() => {})

    const reopen = tour.status === 'booked' && tour.date && tour.date >= todayPT && tour.guide_name
    const patch = reopen
      ? {
          status: 'open', visitor_name: null, visitor_email: null, visitor_phone: null, inquiry_form_id: null, inquiry_answers: null,
          category: null, gcal_event_id: null, staff_notes: null, requested_slots: null, reminder_24h_sent_at: null, reminder_1h_sent_at: null,
          request_handled: null, request_status: null, made_contact_at: null,
        }
      : { status: 'cancelled', gcal_event_id: null }
    const up = await sb(`/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
    if (!up.ok) return jsonResponse({ error: `Could not cancel: ${await up.text()}` }, 500)

    return jsonResponse({ ok: true, calendar, emailed, reopened: !!reopen })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
