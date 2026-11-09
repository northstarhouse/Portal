// Emails an event announcement that looks like the event's RSVP page, with a "Click here to RSVP" button.
// Used from the Portal (Form Builder > Events > Send email). Needs a signed-in Portal session.
//
// POST { action: 'preview' | 'count' | 'send', event_id, subject?, note?, audience: 'test' | 'volunteers' | 'custom', emails?: string, confirm?: boolean }
//   preview -> { html }   count -> { volunteers }   send -> { sent, recipients }
// Real sends (volunteers / custom) need confirm: true, and the same event is not sent to the same audience twice within 12 hours.
// Recipients are blind-copied in batches, so people never see each other's addresses and the office gets one copy per batch.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN = 'media@thenorthstarhouse.org'
const SITE = 'https://northstarhouse.github.io/NSH-forms/?e='
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
}

const longDate = (iso: string) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''
}

// deno-lint-ignore no-explicit-any
function buildHtml(ev: any, note: string) {
  const isShift = ev.event_type === 'shift'
  const link = SITE + encodeURIComponent(ev.slug || '')
  const button = isShift ? 'Click here to sign up' : 'Click here to RSVP'
  const when = [longDate(ev.date), ev.time].filter(Boolean).join(' · ')
  const para = (t: string) => t.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#5a4a35;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  const img = ev.image_url ? `<img src="${esc(ev.image_url)}" alt="${esc(ev.title)}" width="230" style="display:block;width:100%;max-width:230px;height:auto;border:0;">` : ''
  // Same look as the event page: the event heading first, then the picture, then the details and the RSVP card.
  return `<style>@media only screen and (max-width:540px){.ev-text,.ev-img{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}.ev-text{padding-right:0!important}.ev-img{padding:18px 0 0!important}.ev-img img{max-width:100%!important}}</style>
<div style="background:#ece8e1;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:640px;margin:0 auto;">
<div style="height:14px;background:#886c44;line-height:14px;font-size:1px;">&nbsp;</div>
<div style="background:#fdfbf7;padding:32px 30px 30px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#886c44;font-weight:bold;margin:0 0 14px;">${isShift ? 'Volunteer sign-up' : 'Event'}</div>
<h1 style="margin:0 0 20px;font-family:Cardo,Georgia,serif;font-size:34px;line-height:1.15;font-weight:700;color:#1e1a14;">${esc(ev.title)}</h1>
${when ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#2c2418;margin:0 0 8px;"><span style="color:#886c44;">When</span> &nbsp; ${esc(when)}</div>` : ''}
<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#2c2418;margin:0 0 22px;"><span style="color:#886c44;">Where</span> &nbsp; The North Star House</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
<td class="ev-text" valign="top" style="vertical-align:top;${img ? 'padding-right:26px;' : ''}">
${note ? para(note) : ''}
${ev.description ? para(ev.description) : ''}
</td>
${img ? `<td class="ev-img" valign="top" width="230" style="vertical-align:top;width:230px;">${img}</td>` : ''}
</tr></table>
<div style="margin-top:26px;background:#ffffff;border:1px solid #886c44;padding:26px 24px;text-align:center;">
<div style="font-family:Cardo,Georgia,serif;font-size:24px;font-weight:700;color:#1e1a14;margin:0 0 4px;">${isShift ? 'Sign up' : 'RSVP'}</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#a08060;margin:0 0 20px;">${isShift ? 'Pick a shift that works for you' : 'Let us know if you can make it'}</div>
<a href="${esc(link)}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:16px;padding:16px 36px;">${button}</a>
</div>
</div>
</div></div>`
}

// ── Invitation letter style ──────────────────────────────────────────────────────────────────────────────────────────────
// A formal letter look (house sketch, small-caps title, "Dear name,", details between gold rules, signed by the Board) with an
// RSVP: a "Click here to RSVP" button that opens the RSVP page with the guest's name already filled in (?n=).
// replying is one tap and a confirm. (The page asks them to confirm instead of saving on the first tap, so mail scanners that
// open links cannot create RSVPs by themselves.) Used with template: 'letter'. Sent one email per person so each has their own name.
const HOUSE_IMG = 'https://northstarhouse.github.io/Portal/assets/state-of-the-star-house.png'
const GOLD = '#8a6d1f'
const ADDRESS = '12075 Auburn Road · Grass Valley, CA 95949'

const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th')
function friendlyDay(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
  return `${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}, ${d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} ${ordinal(+m[3])}`
}
// "4:00PM-6:00PM" -> "4:00–6:00 PM"
function prettyTime(t: string) {
  const m = String(t || '').match(/(\d{1,2}:\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}:\d{2})\s*(AM|PM)/i)
  if (!m) return String(t || '')
  const a = (m[2] || m[4]).toUpperCase(), b = m[4].toUpperCase()
  return a === b ? `${m[1]}–${m[3]} ${b}` : `${m[1]} ${a} – ${m[3]} ${b}`
}
// Title in small caps: capital letters big, the rest of each word smaller (works in every mail app, unlike font-variant).
function smallCapsTitle(title: string) {
  const small = new Set(['of', 'the', 'a', 'an', 'and', 'for', 'in', 'on', 'at', 'to'])
  return String(title).split(/\s+/).filter(Boolean).map((w) => {
    const u = esc(w.toUpperCase())
    return small.has(w.toLowerCase()) ? `<span style="font-size:36px;">${u}</span>` : `<span style="font-size:52px;">${u.slice(0, 1)}</span><span style="font-size:38px;">${u.slice(1)}</span>`
  }).join('<span style="font-size:36px;">&nbsp;</span>')
}

const ROLES = ['member', 'sponsor', 'donor', 'supporter']
const letterBodyAfterIntro = (role: string) => [
  `Your continued generosity, encouragement, and support are vital to preserving and revitalizing North Star House. As a valued ${role}, you are an important part of this work, and we are sincerely grateful for your commitment.`,
  'This gathering is an opportunity to reflect on recent accomplishments, share updates on ongoing preservation efforts, and offer a look at our vision for the future. We look forward to celebrating the progress made possible by the people who care so deeply about North Star House.',
]
const LETTER_CLOSING = 'We hope you will join us for this special occasion. Thank you for being part of the North Star House story.'

// deno-lint-ignore no-explicit-any
function buildLetterHtml(ev: any, o: { name?: string; text?: string; org?: string; role?: string }) {
  const name = String(o.name || '').trim()
  const org = String(o.org || '').trim()
  const link = `${SITE}${encodeURIComponent(ev.slug || '')}${org ? '&g=sponsor&o=' + encodeURIComponent(org) : o.role === 'member' ? '&g=member' : o.role === 'sponsor' ? '&g=sponsor' : ''}`
  const p = (t: string) => `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#2c2418;">${esc(t).replace(/\n/g, '<br>')}</p>`
  const day = friendlyDay(ev.date)
  const intro = `On behalf of the North Star Historic Conservancy, we warmly invite you to join us for our ${ev.title} gathering${day ? ' on ' + day : ''}.`
  const custom = String(o.text || '').trim()
  const body = custom ? custom.split(/\n{2,}/).map(p).join('') : [intro, ...letterBodyAfterIntro(ROLES.includes(String(o.role)) ? String(o.role) : 'supporter')].map(p).join('')
  const rule = '<div style="border-top:1px solid #c9b27c;line-height:1px;font-size:1px;margin:26px 0;">&nbsp;</div>'
  const btn = (label: string) => `<tr><td align="center" style="padding:0 0 10px;"><a href="${esc(link)}" style="display:block;width:260px;max-width:100%;box-sizing:border-box;background:${GOLD};color:#ffffff;border:1.5px solid ${GOLD};text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;padding:13px 16px;text-align:center;">${label}</a></td></tr>`
  return `<div style="background:#ffffff;padding:28px 12px;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;font-family:Georgia,'Times New Roman',serif;">
<div style="text-align:center;padding:8px 0 0;"><img src="${HOUSE_IMG}" alt="North Star House" width="330" style="display:block;margin:0 auto;width:330px;max-width:80%;height:auto;border:0;"></div>
<div style="text-align:center;margin:18px 0 6px;font-family:'Cormorant SC',Cardo,Georgia,serif;font-weight:700;color:${GOLD};letter-spacing:1px;line-height:1.15;">${smallCapsTitle(ev.title)}</div>
<div style="text-align:center;font-style:italic;font-size:15px;color:#6b6358;margin:0 0 8px;">An Invitation from the North Star Historic Conservancy</div>
${rule}
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#2c2418;">${name ? 'Dear ' + esc(name) + ',' : 'Dear Friend,'}</p>
${body}
${rule}
<div style="text-align:center;">
<div style="font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:.5px;color:${GOLD};margin:0 0 8px;">${esc(longDate(ev.date).toUpperCase())}</div>
${ev.time ? `<div style="font-size:18px;color:#2c2418;margin:0 0 8px;">${esc(prettyTime(ev.time))}</div>` : ''}
<div style="font-size:14px;color:#4a4236;">${esc(ADDRESS)}</div>
</div>
${rule}
<div style="text-align:center;margin:0 0 6px;">
<div style="font-size:22px;font-weight:bold;color:#1e1a14;margin:0 0 4px;">Will you join us?</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#8a7a5c;margin:0 0 18px;">Let us know if you can make it.</div>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-collapse:collapse;">
${btn('Click here to RSVP')}
</table></div>
${rule}
${p(LETTER_CLOSING)}
${p('With sincere appreciation,')}
<p style="margin:0;font-size:16px;font-weight:bold;color:${GOLD};">The Board of Directors</p>
<p style="margin:0 0 30px;font-size:16px;color:#2c2418;">North Star Historic Conservancy</p>
<div style="text-align:center;font-size:13px;letter-spacing:.5px;color:${GOLD};">NORTH STAR HISTORIC CONSERVANCY</div>
<div style="text-align:center;font-size:12px;font-style:italic;color:#9a948a;margin-top:2px;">Tax ID #38-3734947</div>
</div></div>`
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
const firstNameOf = (v: unknown) => { const w = String(v ?? '').trim().split(/\s+/)[0] || ''; return /^[A-Za-z][A-Za-z'’.-]*$/.test(w) ? w : '' }

// A greeting typed after the email, up to a few words ("Bob and Sue", "Dr. Lee"); anything odd falls back to "Dear Friend".
const greetingOf = (v: unknown) => { const g = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 60); return /^[A-Za-z][A-Za-z'’.\- &]*$/.test(g) ? g : '' }

// Current sponsors, the same rule the Portal uses: gave this year, or their status is blank or "current".
async function sponsorPeople(): Promise<{ email: string; name: string; org?: string }[]> {
  const yr = new Date().getFullYear()
  // deno-lint-ignore no-explicit-any
  const kind: any[] = await sb(`/rest/v1/${encodeURIComponent('Sponsor In-Kind')}?select=sponsor_id&date=gte.${yr}-01-01`).then((r) => r.json()).catch(() => [])
  const gave = new Set((Array.isArray(kind) ? kind : []).map((k) => k.sponsor_id))
  // deno-lint-ignore no-explicit-any
  const rows: any[] = await sb(`/rest/v1/Sponsors?select=${encodeURIComponent('id,"Business Name","Main Contact","Email Address",sponsor_status')}`).then((r) => r.json()).catch(() => [])
  const seen = new Set<string>(), out: { email: string; name: string; org?: string }[] = []
  for (const s of Array.isArray(rows) ? rows : []) {
    if (!(gave.has(s.id) || !s.sponsor_status || s.sponsor_status === 'current')) continue
    for (const e of String(s['Email Address'] || '').split(/[\s,;]+/)) {
      const em = e.trim().toLowerCase()
      if (EMAIL_RE.test(em) && !seen.has(em)) { seen.add(em); out.push({ email: em, name: String(s['Business Name'] || '').trim().slice(0, 80), org: String(s['Business Name'] || '').trim() }) }
    }
  }
  return out
}

// One line per person: "email" or "email, First name" (or "First name email").
function customPeople(text: string): { email: string; name: string }[] {
  const seen = new Set<string>(), out: { email: string; name: string }[] = []
  for (const line of String(text || '').split(/\n|;/)) {
    const em = (line.match(/[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+/) || [])[0]?.toLowerCase()
    if (!em || seen.has(em)) continue
    seen.add(em)
    out.push({ email: em, name: greetingOf(line.replace(em, '').replace(/[<>,]/g, ' ')) })
  }
  return out
}

// deno-lint-ignore no-explicit-any
async function handleLetter(ev: any, body: any, action: string) {
  const text = String(body.letter || '').trim().slice(0, 4000)
  const role = ROLES.includes(String(body.role)) ? String(body.role) : (String(body.audience) === 'sponsors' ? 'sponsor' : 'supporter')
  if (action === 'preview') return json({ html: buildLetterHtml(ev, { name: String(body.preview_name || '').slice(0, 60), text, role }) })
  const audience = String(body.audience || 'test')
  let people: { email: string; name: string; org?: string }[]
  if (audience === 'test') people = [{ email: ADMIN, name: '' }]
  else if (audience === 'sponsors') people = await sponsorPeople()
  else if (audience === 'custom') people = customPeople(String(body.emails || ''))
  else return json({ error: 'Choose who to send it to.' }, 400)
  people = people.slice(0, 100)
  if (!people.length) return json({ error: 'There is nobody to send it to.' }, 400)
  if (audience !== 'test') {
    if (body.confirm !== true) return json({ error: 'Please confirm the send.' }, 400)
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    const prior = await sb(`/rest/v1/activity_log?action=eq.event_email_sent&created_at=gte.${encodeURIComponent(since)}&detail->>event_id=eq.${encodeURIComponent(ev.id)}&detail->>audience=eq.letter-${audience}&select=created_at&limit=1`).then((r) => r.json()).catch(() => [])
    if (Array.isArray(prior) && prior.length && body.resend !== true) return json({ error: 'already sent', already_sent_at: prior[0].created_at }, 409)
  }
  const subject = String(body.subject || '').trim().slice(0, 150) || `You're invited: ${ev.title}`
  let sent = 0
  for (const p of people) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        to: p.email, subject: audience === 'test' ? `[Test] ${subject}` : subject,
        body: `${p.name ? 'Dear ' + p.name : 'Dear Friend'},\n\nYou are invited to ${ev.title}: ${[longDate(ev.date), prettyTime(ev.time)].filter(Boolean).join(', ')}, ${ADDRESS}.\n\nRSVP: ${SITE}${ev.slug}${p.org ? '&g=sponsor&o=' + encodeURIComponent(p.org) : ''}\n\nThe Board of Directors\nNorth Star Historic Conservancy`,
        html: buildLetterHtml(ev, { name: p.name, text, org: p.org, role }), sender: 'North Star House',
      }),
    })
    if (!r.ok) return json({ error: `The email could not be sent (sent ${sent} so far). Please try again.`, sent }, 502)
    sent++
  }
  if (audience !== 'test') {
    await sb('/rest/v1/activity_log', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ description: `Invitation letter sent: ${ev.title} (${audience === 'sponsors' ? 'current sponsors' : 'custom list'}, ${people.length} ${people.length === 1 ? 'person' : 'people'})`, volunteer_name: String(body.sent_by || '') || null, action: 'event_email_sent', tag: 'Events', detail: { event_id: ev.id, audience: `letter-${audience}`, count: people.length, subject, emails: people.map((p) => p.email) } }),
    }).catch(() => {})
  }
  return json({ ok: true, sent, recipients: audience === 'test' ? 1 : people.length })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    const ok = await sb('/rest/v1/rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': req.headers.get('x-app-token') || '' }, body: '{}' }).then((r) => r.json()).catch(() => false)
    if (ok !== true) return json({ error: 'Please sign in again.' }, 401)
    const body = await req.json()
    const action = String(body.action || 'send')

    // deno-lint-ignore no-explicit-any
    const volunteerList = async (): Promise<string[]> => {
      const rows: any[] = await sb('/rest/v1/' + encodeURIComponent('2026 Volunteers') + '?select=Email,Status&Status=in.(Active,"On-Call Supporter")').then((r) => r.json()).catch(() => [])
      return [...new Set((Array.isArray(rows) ? rows : []).map((r) => String(r.Email || '').trim().toLowerCase()).filter((e) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e)))]
    }
    if (action === 'count') return json({ volunteers: (await volunteerList()).length, sponsors: (await sponsorPeople()).length })

    const evRows = await sb(`/rest/v1/vol_events?id=eq.${encodeURIComponent(String(body.event_id || ''))}&select=id,title,date,time,description,image_url,slug,event_type`).then((r) => r.json())
    const ev = Array.isArray(evRows) ? evRows[0] : null
    if (!ev) return json({ error: 'Event not found.' }, 404)
    if (!ev.slug) return json({ error: 'This event has no public link yet.' }, 400)
    if (String(body.template || '') === 'letter') return await handleLetter(ev, body, action)
    const note = String(body.note || '').trim().slice(0, 1500)
    const html = buildHtml(ev, note)
    if (action === 'preview') return json({ html })

    const audience = String(body.audience || 'test')
    const subject = String(body.subject || '').trim().slice(0, 150) || (ev.event_type === 'shift' ? `Volunteer sign-up: ${ev.title}` : `You're invited: ${ev.title}`)
    let recipients: string[] = []
    if (audience === 'test') recipients = [ADMIN]
    else if (audience === 'volunteers') recipients = await volunteerList()
    else if (audience === 'custom') recipients = [...new Set(String(body.emails || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e)))].slice(0, 300)
    else return json({ error: 'Choose who to send it to.' }, 400)
    if (!recipients.length) return json({ error: 'There is nobody to send it to.' }, 400)

    if (audience !== 'test') {
      if (body.confirm !== true) return json({ error: 'Please confirm the send.' }, 400)
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
      const prior = await sb(`/rest/v1/activity_log?action=eq.event_email_sent&created_at=gte.${encodeURIComponent(since)}&detail->>event_id=eq.${encodeURIComponent(ev.id)}&detail->>audience=eq.${audience}&select=created_at&limit=1`).then((r) => r.json()).catch(() => [])
      if (Array.isArray(prior) && prior.length && body.resend !== true) return json({ error: 'already sent', already_sent_at: prior[0].created_at }, 409)
    }

    // Test goes straight to the office; real sends go out in blind-copied batches (Resend allows 50 addresses per message).
    const batches: string[][] = audience === 'test' ? [[ADMIN]] : Array.from({ length: Math.ceil(recipients.length / 40) }, (_, i) => recipients.slice(i * 40, i * 40 + 40))
    let sent = 0
    for (const batch of batches) {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify(audience === 'test'
          ? { to: ADMIN, subject: `[Test] ${subject}`, body: `${ev.title}: ${SITE}${ev.slug}`, html, sender: 'North Star House' }
          : { to: ADMIN, bcc: batch, subject, body: `${ev.title}\n${[longDate(ev.date), ev.time].filter(Boolean).join(' · ')}\n\nRSVP: ${SITE}${ev.slug}`, html, sender: 'North Star House' }),
      })
      if (!r.ok) return json({ error: `The email could not be sent (sent ${sent} so far). Please try again.`, sent }, 502)
      sent += batch.length
    }
    if (audience !== 'test') {
      await sb('/rest/v1/activity_log', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ description: `Event email sent: ${ev.title} (${audience === 'volunteers' ? 'active volunteers' : 'custom list'}, ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'})`, volunteer_name: String(body.sent_by || '') || null, action: 'event_email_sent', tag: 'Events', detail: { event_id: ev.id, audience, count: recipients.length, subject } }),
      }).catch(() => {})
    }
    return json({ ok: true, sent, recipients: audience === 'test' ? 1 : recipients.length })
  } catch (e) {
    return json({ error: (e as Error).message || 'Could not send.' }, 500)
  }
})
