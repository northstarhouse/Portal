// Deletes one estate_tours row. Exists because estate_tours' RLS allows the
// publishable/anon key to INSERT and UPDATE (needed for the public site's
// own booking flow) but not DELETE -- confirmed live: an anon-key DELETE
// against a real row returns 204 with the row still present. Staff-side
// deletes (clearing test bookings, cancelling a booking outright) go
// through this function instead, using the service role key.
//
// Also removes the row's Google Calendar event if it had one (see
// add-tour-to-calendar / add_tour_calendar_sync.sql) -- best-effort: the
// Supabase row is the source of truth, so a Calendar API failure here
// doesn't fail the delete, it just leaves a stray calendar event to clean
// up by hand.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
const CALENDAR_ID = 'thenorthstarhouse@gmail.com'

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
  const data = await res.json()
  return data.access_token
}

async function deleteCalendarEvent(eventId: string) {
  try {
    const token = await getCalendarAccessToken()
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // best-effort -- row is already deleted either way
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
    const { id } = await req.json()
    if (!id || typeof id !== 'string') return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

    const res = await fetch(`${SUPABASE_URL}/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
    })
    const deleted = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: deleted }), { status: 500 })
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return new Response(JSON.stringify({ error: 'No row with that id' }), { status: 404 })
    }

    if (deleted[0].gcal_event_id && GOOGLE_SERVICE_ACCOUNT_KEY) {
      await deleteCalendarEvent(deleted[0].gcal_event_id)
    }

    return new Response(JSON.stringify({ ok: true, deleted: deleted[0] }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
