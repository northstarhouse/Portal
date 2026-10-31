// Brings emails sent to venue@thenorthstarhouse.org into the Portal's Messages tab (replies to our emails, and anything
// else from real people). Runs every few minutes from pg_cron. Reads the mailbox through the same Google service account the
// calendar uses, impersonating venue@ (needs domain-wide delegation for the gmail.readonly scope; see the setup notes).
//
// - Mail from a known client (their pre-booking form email) is filed under that client: event_uid = 'client:<id>'.
// - Mail from anyone else is kept as 'inbox:' so it still shows up, marked as an unknown sender.
// - Google Voice voicemail emails (voice-noreply@google.com) are imported as voicemails (event_uid = 'voicemail:'), with the
//   transcript as the message. This replaces the old spreadsheet-based voicemail list.
// - Skipped: our own emails (BCC copies) and no-reply / automated senders.
// - Each Gmail message is imported once (venue_messages.gmail_id is unique).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
const MAILBOX = 'venue@thenorthstarhouse.org'
const PRE_BOOKING_FORMS = ['a3a383f7-e1db-4344-9dec-ea879ad3406d', '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8']
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
}

// ---------- Google (service account, acting as the mailbox) ----------
function b64url(bytes: ArrayBuffer | Uint8Array) {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of a) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function gmailToken(): Promise<string> {
  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY!)
  const now = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const input = `${b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, sub: MAILBOX, scope: 'https://www.googleapis.com/auth/gmail.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })))}`
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${input}.${b64url(sig)}`,
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Google sign-in failed (${r.status}): ${d.error_description || d.error || ''}`)
  return d.access_token
}

// ---------- reading a message ----------
// deno-lint-ignore no-explicit-any
type Part = any
function decode(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
function findBody(part: Part, mime: string): string {
  if (!part) return ''
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data)
  for (const p of part.parts || []) { const t = findBody(p, mime); if (t) return t }
  return ''
}
function htmlToText(h: string) {
  return h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ')
}
// Just what the person wrote: drop the quoted copy of the earlier email.
function newTextOnly(t: string) {
  const cut = t.search(/^\s*(On .{5,200}wrote:|-{2,}\s*Original Message\s*-{2,}|From:\s.+\nSent:\s)/m)
  let out = cut > 0 ? t.slice(0, cut) : t
  out = out.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n')
  return out.replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000)
}
const header = (m: Part, name: string) => (m.payload?.headers || []).find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
function parseFrom(v: string) {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  return m ? { name: m[1].trim(), email: m[2].trim().toLowerCase() } : { name: '', email: v.trim().toLowerCase() }
}

// Gmail tells us the moment something changes: a Pub/Sub topic is "watched" on the mailbox and pushes to this function.
// The watch lasts 7 days, so a weekly call with { action: 'watch' } renews it. The topic name comes from GMAIL_PUBSUB_TOPIC.
async function registerWatch(auth: Record<string, string>) {
  const topicName = Deno.env.get('GMAIL_PUBSUB_TOPIC')
  if (!topicName) return { error: 'GMAIL_PUBSUB_TOPIC is not set' }
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ topicName, labelIds: ['INBOX'] }),
  })
  const d = await r.json()
  return r.ok ? { watching: true, expires: d.expiration } : { error: d.error?.message || `Gmail watch failed (${r.status})` }
}

Deno.serve(async (req) => {
  try {
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) return json({ error: 'Google service account is not configured' }, 503)
    const token = await gmailToken()
    const auth = { Authorization: `Bearer ${token}` }
    // Renewal call (weekly) or first-time setup.
    const asked = await req.clone().json().catch(() => ({}))
    if (asked && asked.action === 'watch') {
      const w = await registerWatch(auth)
      return json(w, 'error' in w ? 500 : 200)
    }

    // Recent inbox mail from people (not our own BCC copies, not automated, not voicemail notices).
    const q = 'in:inbox newer_than:3d -category:promotions -category:social -from:(noreply OR no-reply OR mailer-daemon OR notifications OR voice-noreply@google.com OR info@northstarhouse.org OR venue@northstarhouse.org OR venue@thenorthstarhouse.org OR eventective OR globaleventsupply.com OR paypal)'
    const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`, { headers: auth }).then((r) => r.json())
    if (list.error) throw new Error(`Gmail: ${list.error.message || JSON.stringify(list.error)}`)
    // Google Voice voicemails come from voice-noreply@google.com (excluded from the people query above).
    const vmList = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent('in:inbox newer_than:3d from:voice-noreply@google.com')}`, { headers: auth }).then((r) => r.json())
    const ids: string[] = Array.from(new Set([...(list.messages || []), ...(vmList.messages || [])].map((m: { id: string }) => m.id)))
    if (!ids.length) return json({ ok: true, imported: 0 })

    // Skip anything already imported.
    const seenRows = await sb(`/rest/v1/venue_messages?select=gmail_id&gmail_id=in.(${ids.map((i) => `"${i}"`).join(',')})`).then((r) => r.json())
    const seen = new Set((Array.isArray(seenRows) ? seenRows : []).map((r: { gmail_id: string }) => r.gmail_id))
    const fresh = ids.filter((i) => !seen.has(i))
    if (!fresh.length) return json({ ok: true, imported: 0 })

    // Known clients, by email.
    const clients = new Map<string, { id: string; name: string }>()
    const forms = await sb(`/rest/v1/nsh_form_responses?select=id,answers&form_id=in.(${PRE_BOOKING_FORMS.join(',')})&limit=1000`).then((r) => r.json())
    for (const f of Array.isArray(forms) ? forms : []) {
      const a = f.answers || {}
      const label = [a['7fnabd0i'] || a.evp_name, a['7leui2ic']].filter(Boolean).join(' + ')
      for (const e of [a.c9u1sxb4, a.pt4mail1, a.evp_email]) if (e) clients.set(String(e).trim().toLowerCase(), { id: f.id, name: label })
    }

    let imported = 0
    for (const id of fresh) {
      const m = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: auth }).then((r) => r.json())
      if (m.error) continue
      const from = parseFrom(header(m, 'From'))
      if (!from.email) continue
      const text = findBody(m.payload, 'text/plain') || htmlToText(findBody(m.payload, 'text/html'))
      const when = Number(m.internalDate) ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString()
      if (from.email === 'voice-noreply@google.com') {
        // "New voicemail from Name (###) ###-####": keep the transcript, drop Google's footer lines.
        const subject = header(m, 'Subject')
        const caller = subject.replace(/^new voicemail from\s*/i, '').trim() || 'Unknown caller'
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !/^(play message|to play|reply|this message|you received|google voice|view in|\[?image|https?:\/\/)/i.test(l))
        const transcript = lines.join(' ').replace(/\s{2,}/g, ' ').slice(0, 3000)
        if (!transcript) continue
        const vm = await sb('/rest/v1/venue_messages?on_conflict=gmail_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ gmail_id: id, event_uid: 'voicemail:', event_title: null, subject: `Voicemail: ${caller}`, body: transcript, from_name: caller, from_email: null, direction: 'incoming', created_at: when }),
        })
        if (vm.ok) imported++
        continue
      }
      const body = newTextOnly(text)
      if (!body) continue
      const known = clients.get(from.email)
      const res = await sb('/rest/v1/venue_messages?on_conflict=gmail_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          gmail_id: id, event_uid: known ? `client:${known.id}` : 'inbox:', event_title: known ? known.name : null,
          subject: `Email: ${header(m, 'Subject') || '(no subject)'}`, body, from_name: from.name || from.email, from_email: from.email, direction: 'incoming', created_at: when,
        }),
      })
      if (res.ok) imported++
    }
    return json({ ok: true, imported })
  } catch (e) {
    console.error('sync-venue-inbox', e instanceof Error ? e.message : e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
