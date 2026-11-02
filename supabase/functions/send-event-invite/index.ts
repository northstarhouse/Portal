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
  const img = ev.image_url ? `<img src="${esc(ev.image_url)}" alt="${esc(ev.title)}" width="576" style="display:block;width:100%;max-width:576px;height:auto;border:0;">` : ''
  // Same look as the event page: the event heading first, then the picture, then the details and the RSVP card.
  return `<div style="background:#ece8e1;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:640px;margin:0 auto;">
<div style="height:14px;background:#886c44;line-height:14px;font-size:1px;">&nbsp;</div>
<div style="background:#fdfbf7;padding:32px 30px 30px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#886c44;font-weight:bold;margin:0 0 14px;">${isShift ? 'Volunteer sign-up' : 'Event'}</div>
<h1 style="margin:0 0 20px;font-family:Cardo,Georgia,serif;font-size:34px;line-height:1.15;font-weight:700;color:#1e1a14;">${esc(ev.title)}</h1>
${when ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#2c2418;margin:0 0 8px;"><span style="color:#886c44;">When</span> &nbsp; ${esc(when)}</div>` : ''}
<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#2c2418;margin:0 0 22px;"><span style="color:#886c44;">Where</span> &nbsp; The North Star House</div>
${note ? para(note) : ''}
${img ? `<div style="margin:0 0 22px;">${img}</div>` : ''}
${ev.description ? para(ev.description) : ''}
<div style="margin-top:26px;background:#ffffff;border:1px solid #886c44;padding:26px 24px;text-align:center;">
<div style="font-family:Cardo,Georgia,serif;font-size:24px;font-weight:700;color:#1e1a14;margin:0 0 4px;">${isShift ? 'Sign up' : 'RSVP'}</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#a08060;margin:0 0 20px;">${isShift ? 'Pick a shift that works for you' : 'Let us know if you can make it'}</div>
<a href="${esc(link)}" style="display:inline-block;background:#886c44;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:16px;padding:16px 36px;">${button}</a>
</div>
</div>
</div></div>`
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
    if (action === 'count') return json({ volunteers: (await volunteerList()).length })

    const evRows = await sb(`/rest/v1/vol_events?id=eq.${encodeURIComponent(String(body.event_id || ''))}&select=id,title,date,time,description,image_url,slug,event_type`).then((r) => r.json())
    const ev = Array.isArray(evRows) ? evRows[0] : null
    if (!ev) return json({ error: 'Event not found.' }, 404)
    if (!ev.slug) return json({ error: 'This event has no public link yet.' }, 400)
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
