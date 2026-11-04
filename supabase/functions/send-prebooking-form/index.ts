// Emails the pre-booking form to someone on the inquiry list (Portal: Venue Rentals > Inquiries > "Send Pre-Booking Form").
// Wedding inquiries get the wedding pre-booking form; every other kind of event gets the event one (same rule the
// venue pipeline uses after a tour). Each send is recorded in prebooking_form_sends so the Portal can show "sent",
// and a second send needs resend: true so a double click can't email someone twice.
//
// POST body: { response_id: uuid, resend?: boolean }
//   or, for someone who never went through an inquiry (nonprofits, special arrangements), from a signed-in Portal session:
//      { manual: true, email, name?, event_type, arrangement?: 'standard' | 'bylt', sent_by?, resend?: boolean }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEDDING_INQUIRY_FORM_ID = '1eea2137-f94d-414b-a977-4ed622214580'
const PREBOOKING_FORM_URL_WEDDING = 'https://northstarhouse.github.io/NSH-forms/?view=form&id=a3a383f7-e1db-4344-9dec-ea879ad3406d'
const PREBOOKING_FORM_URL_EVENT = 'https://northstarhouse.github.io/NSH-forms/?view=form&id=668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'
const GUIDEBOOK_URL = 'https://venue.northstarhouse.org/guidebook/'
const GOLD = '#886c44'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const esc = (s: string) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

const AVAILABILITY_URL = 'https://northstarhouse.github.io/venue/?availability=1'

type Kind = 'wedding' | 'memorial' | 'nonprofit' | 'event'
const SITE = 'https://www.northstarhouse.org'
const kindFromForm = (formId: string): Kind =>
  formId === WEDDING_INQUIRY_FORM_ID ? 'wedding' : formId === '952bc156-e89d-4790-814d-d2c2e9738a8b' ? 'memorial' : formId === 'e8cc69a1-1693-4fb4-8518-b8bb486dd055' ? 'nonprofit' : 'event'
const kindFromType = (t: string): Kind => (t === 'Wedding' ? 'wedding' : t === 'Memorial' ? 'memorial' : t === 'Nonprofit Event' ? 'nonprofit' : 'event')

type Row = { a: string; b: string; c?: string }
const MEMORIAL_RATES: Row[] = [{ a: 'Friday', b: '$400' }, { a: 'Saturday', b: '$800' }, { a: 'Sunday', b: '$600' }]
const NONPROFIT_RATES: Row[] = [
  { a: 'Large Private Event', b: '$800', c: 'Up to 200 guests, 4 hours. Each extra hour $150.' },
  { a: 'Small Private Event', b: '$600', c: 'Up to 50 guests, 4 hours. Each extra hour $150.' },
  { a: 'Public Event', b: '$2,000', c: 'Permit capacity, 6 hours. Each extra hour $300.' },
]
const P = 'font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#555;'
const H3 = 'margin:26px 0 8px;font-family:Georgia,serif;font-size:19px;font-weight:400;color:#2a2420;'
const para = (t: string) => `<p style="${P}">${t}</p>`
const linkBtn = (href: string, label: string) => `<a href="${href}" style="display:block;margin:0 0 10px;padding:13px 24px;text-align:center;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:14px;background:#ffffff;color:${GOLD};border:1px solid ${GOLD};">${label}</a>`
const rateTable = (rows: Row[]) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 14px;border-collapse:collapse;">${rows.map((r) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e5ddcf;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#2a2420;"><strong>${esc(r.a)}</strong>${r.c ? `<br><span style="font-size:13px;color:#777;">${esc(r.c)}</span>` : ''}</td><td style="padding:10px 0;border-bottom:1px solid #e5ddcf;text-align:right;font-family:Georgia,serif;font-size:20px;color:${GOLD};white-space:nowrap;">${esc(r.b)}</td></tr>`).join('')}</table>`
const rateText = (rows: Row[]) => rows.map((r) => `- ${r.a}: ${r.b}${r.c ? ' (' + r.c + ')' : ''}`).join('\n')

function detailsHtml(kind: Kind): string {
  if (kind === 'wedding') {
    return `<h3 style="${H3}">Pricing</h3>` +
      para('<strong>$5,000</strong>, one price. It makes the estate yours for the day. A non-refundable <strong>$800 retainer</strong> reserves your date and counts toward the total, and an <strong>$800 refundable security deposit</strong> is due one month before your wedding.') +
      linkBtn(`${SITE}/weddings`, 'View Pricing &amp; Details') +
      `<h3 style="${H3}">Common Questions</h3>` +
      para('<strong>How do I reserve my date?</strong><br>Sign the venue agreement and pay the $800 retainer, which counts toward your total.') +
      para('<strong>Are tables and chairs included?</strong><br>Yes. We provide 25 round 60" tables, 200 white folding chairs, three 8-foot and two 6-foot rectangular tables, plus patio tables, chairs and umbrellas. Use any or all of them, or bring in additional rentals.') +
      para('<strong>How much time do we get?</strong><br>A 10-hour rental period, starting when we open the indoor venue for you. You choose the start time, with an 11 PM latest end. Extra hours are $150 each.') +
      para('<strong>Can we bring our own caterer?</strong><br>Yes, any professional caterer. We will walk them through our facilities, and we have a list of recommended vendors if you would like ideas.') +
      para('<strong>What is the lighting like?</strong><br>The estate is already lit with string lights in the courtyard and over the East Lawn, twinkle pillar lights and trim lighting on the House.') +
      para('<strong>Do you help with planning?</strong><br>Yes. We offer up to two onsite planning meetings to go over your details, and we send a planning questionnaire about 60 days out so everything is ready for your Site Manager.') +
      para('<strong>Is the security deposit refundable?</strong><br>Yes. It is returned after your event if there is no damage and policies are followed.') +
      para('<strong>Do we need insurance?</strong><br>Yes, a $1 million liability policy naming North Star Historic Conservancy as additionally insured. These policies are typically inexpensive for a single event.') +
      linkBtn(`${SITE}/weddings#faq`, 'Read the Full Q&amp;A')
  }
  if (kind === 'memorial') {
    return `<h3 style="${H3}">Memorial Pricing</h3>` + rateTable(MEMORIAL_RATES) + para('Each rental is 4 hours, and memorial dates are booked up to 3 months in advance.') + linkBtn(`${SITE}/memorials`, 'About Memorials')
  }
  if (kind === 'nonprofit') {
    return `<h3 style="${H3}">Nonprofit Pricing</h3>` + para('Saturday and Sunday rates:') + rateTable(NONPROFIT_RATES) + linkBtn(`${SITE}/nonprofit`, 'Nonprofit Rentals')
  }
  return `<h3 style="${H3}">Pricing</h3>` + para("Rates depend on the size and type of your event. We're happy to go over them with you by reply.") + linkBtn(`${SITE}/private-events`, 'Learn About Events')
}

function detailsText(kind: Kind): string {
  if (kind === 'wedding') {
    return `PRICING
$5,000, one price. A non-refundable $800 retainer reserves your date and counts toward the total, and an $800 refundable security deposit is due one month before your wedding.
Pricing & details: ${SITE}/weddings

COMMON QUESTIONS
How do I reserve my date? Sign the venue agreement and pay the $800 retainer, which counts toward your total.
Is the security deposit refundable? Yes. It is returned after your event if there is no damage and policies are followed.
Are tables and chairs included? Yes. We provide 25 round 60" tables, 200 white folding chairs, three 8-foot and two 6-foot rectangular tables, plus patio tables, chairs and umbrellas. Use any or all of them, or bring in additional rentals.
How much time do we get? A 10-hour rental period, starting when we open the indoor venue for you. You choose the start time, with an 11 PM latest end. Extra hours are $150 each.
Can we bring our own caterer? Yes, any professional caterer. We will walk them through our facilities, and we have a list of recommended vendors if you would like ideas.
What is the lighting like? The estate is already lit with string lights in the courtyard and over the East Lawn, twinkle pillar lights and trim lighting on the House.
Do you help with planning? Yes. We offer up to two onsite planning meetings to go over your details, and we send a planning questionnaire about 60 days out so everything is ready for your Site Manager.
Do we need insurance? Yes, a $1 million liability policy naming North Star Historic Conservancy as additionally insured.
Full Q&A: ${SITE}/weddings#faq`
  }
  if (kind === 'memorial') return `MEMORIAL PRICING
${rateText(MEMORIAL_RATES)}
Each rental is 4 hours, and memorial dates are booked up to 3 months in advance.
${SITE}/memorials`
  if (kind === 'nonprofit') return `NONPROFIT PRICING (Saturday and Sunday)
${rateText(NONPROFIT_RATES)}
${SITE}/nonprofit`
  return `PRICING
Rates depend on the size and type of your event. We're happy to go over them with you by reply.
${SITE}/private-events`
}

function emailText(first: string, link: string, kind: Kind) {
  return `Hi ${first},

Thank you for your interest in North Star House. When you're ready to reserve your date, the next step is our short pre-booking form. It tells us about you and your event so we can prepare your agreement: ${link}

${detailsText(kind)}

You can also see our booking availability here: ${AVAILABILITY_URL}
(Note: if you have asked a venue coordinator to put a date on hold, that date may appear unavailable.)

If you have any questions, just reply to this email. We're here to support you every step of the way.

The North Star House Venue Team
www.NorthStarHouse.org`
}

function emailHtml(first: string, link: string, kind: Kind) {
  const p = 'margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#444;'
  return `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${GOLD};"></div><div style="padding:40px 40px 32px;">
<h1 style="margin:0 0 16px;font-family:'Cardo',Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:#2a2420;">Your Pre-Booking Form</h1>
<p style="${p}">Hi ${esc(first)},</p>
<p style="${p}">Thank you for your interest in North Star House. When you're ready to reserve your date, the next step is our short pre-booking form. It tells us about you and your event so we can prepare your agreement.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;"><tr>
<td><a href="${link}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Fill Out the Pre-Booking Form</a></td>
</tr></table>
${detailsHtml(kind)}
<p style="${p}">If you have any questions or need further details, just reply to this email. We're here to support you every step of the way.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f7f3ec;border-radius:10px;"><tr><td style="padding:16px 20px;text-align:center;">
<a href="${AVAILABILITY_URL}" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:${GOLD};text-decoration:none;">View Venue Availability Calendar &rarr;</a>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#999;margin-top:6px;">If you've asked a venue coordinator to put a date on hold, that date may appear unavailable.</div>
</td></tr></table>
<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#888;">The North Star House Venue Team<br/>www.NorthStarHouse.org</p>
</div></div></div>`
}

const MANUAL_EVENT_TYPES = ['Wedding', 'Private Event', 'Memorial', 'Nonprofit Event', 'Other']
const ARRANGEMENTS: Record<string, string> = { standard: 'Standard', bylt: 'BYLT special rate' }

// Sent by hand: just an email and an event type (plus the arrangement). Needs a signed-in Portal session so it cannot be
// used to send mail to arbitrary addresses.
async function manualSend(req: Request, body: Record<string, unknown>) {
  const token = req.headers.get('x-app-token') || ''
  const ok = await sb('/rest/v1/rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': token }, body: '{}' }).then((r) => r.json()).catch(() => false)
  if (ok !== true) return json({ error: 'Please sign in again.' }, 401)
  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim().slice(0, 80)
  const eventType = String(body.event_type || '')
  const arrangement = ARRANGEMENTS[String(body.arrangement || 'standard')] ? String(body.arrangement || 'standard') : 'standard'
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
  if (!MANUAL_EVENT_TYPES.includes(eventType)) return json({ error: 'Choose the event type.' }, 400)

  const recent = await sb(`/rest/v1/prebooking_manual_sends?email=ilike.${encodeURIComponent(email)}&select=sent_at&order=sent_at.desc&limit=1`).then((r) => r.json()).catch(() => [])
  if (Array.isArray(recent) && recent.length && !body.resend) return json({ error: 'already sent', already_sent_at: recent[0].sent_at }, 409)

  const link = eventType === 'Wedding' ? PREBOOKING_FORM_URL_WEDDING : PREBOOKING_FORM_URL_EVENT
  const first = name.split(/\s+/)[0] || 'there'
  const text = emailText(first, link, kindFromType(eventType))
  const mail = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ to: email, subject: 'Your North Star House pre-booking form', body: text, html: emailHtml(first, link, kindFromType(eventType)), sender: 'Venue Team', fromEmail: 'venue@northstarhouse.org' }),
  })
  if (!mail.ok) return json({ error: 'The email could not be sent. Please try again.' }, 502)

  const sentAt = new Date().toISOString()
  await sb('/rest/v1/prebooking_manual_sends', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ email, name: name || null, event_type: eventType, arrangement, form_url: link, sent_by: String(body.sent_by || '').slice(0, 80) || null, sent_at: sentAt }) })
  await sb('/rest/v1/activity_log', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ description: `Pre-booking form sent to ${name || email} (${eventType}${arrangement !== 'standard' ? ', ' + ARRANGEMENTS[arrangement] : ''})`, volunteer_name: String(body.sent_by || '') || null, action: 'prebooking_form_sent', tag: 'Venue', detail: { email, event_type: eventType, arrangement, form_url: link, manual: true } }),
  }).catch(() => {})
  return json({ ok: true, sent_at: sentAt, email })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    const payload = await req.json()
    if (payload && payload.manual === true) return await manualSend(req, payload)
    const { response_id, resend } = payload
    if (!response_id || typeof response_id !== 'string') return json({ error: 'response_id required' }, 400)

    const rows = await sb(`/rest/v1/nsh_form_responses?id=eq.${encodeURIComponent(response_id)}&select=id,form_id,answers`).then((r) => r.json())
    const resp = Array.isArray(rows) ? rows[0] : null
    if (!resp) return json({ error: 'No inquiry with that id' }, 404)

    // name + email: found by field label, because each inquiry form uses its own field ids
    const forms = await sb(`/rest/v1/nsh_forms?id=eq.${resp.form_id}&select=fields`).then((r) => r.json())
    const fields: { id: string; label?: string }[] = Array.isArray(forms) && forms[0] ? forms[0].fields || [] : []
    const answers = resp.answers || {}
    const pick = (re: RegExp, not?: RegExp) => {
      const f = fields.find((x) => re.test(x.label || '') && !(not && not.test(x.label || '')))
      const v = f ? answers[f.id] : ''
      return typeof v === 'string' ? v.trim() : ''
    }
    const email = pick(/email/i)
    const name = pick(/name/i, /partner|business|organization|event/i)
    if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) return json({ error: 'This inquiry has no valid email address.' }, 400)

    const prior = await sb(`/rest/v1/prebooking_form_sends?response_id=eq.${encodeURIComponent(response_id)}&select=sent_at`).then((r) => r.json())
    if (Array.isArray(prior) && prior.length && !resend) return json({ error: 'already sent', already_sent_at: prior[0].sent_at }, 409)

    const link = resp.form_id === WEDDING_INQUIRY_FORM_ID ? PREBOOKING_FORM_URL_WEDDING : PREBOOKING_FORM_URL_EVENT
    const first = name.split(/\s+/)[0] || 'there'
    const kind = kindFromForm(resp.form_id)
    const body = emailText(first, link, kind)
    const mail = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to: email, subject: 'Your North Star House pre-booking form', body, html: emailHtml(first, link, kind), sender: 'Venue Team', fromEmail: 'venue@northstarhouse.org' }),
    })
    if (!mail.ok) return json({ error: 'The email could not be sent. Please try again.' }, 502)

    const sentAt = new Date().toISOString()
    await sb('/rest/v1/prebooking_form_sends?on_conflict=response_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ response_id, email: email.toLowerCase(), form_url: link, sent_at: sentAt }),
    })
    await sb('/rest/v1/activity_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ description: `Pre-booking form sent to ${name || email}`, action: 'prebooking_form_sent', tag: 'Venue', detail: { response_id, email, form_url: link } }),
    }).catch(() => {})
    return json({ ok: true, sent_at: sentAt, email })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
