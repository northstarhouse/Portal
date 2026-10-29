// Emails the pre-booking form to someone on the inquiry list (Portal: Venue Rentals > Inquiries > "Send Pre-Booking Form").
// Wedding inquiries get the wedding pre-booking form; every other kind of event gets the event one (same rule the
// venue pipeline uses after a tour). Each send is recorded in prebooking_form_sends so the Portal can show "sent",
// and a second send needs resend: true so a double click can't email someone twice.
//
// POST body: { response_id: uuid, resend?: boolean }

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

function emailHtml(first: string, link: string) {
  const text = 'font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#555;'
  return `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${GOLD};"></div><div style="padding:44px 40px 36px;">
<div style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:${GOLD};font-weight:bold;margin-bottom:14px;">NORTH STAR HOUSE</div>
<h1 style="margin:0 0 22px;text-align:center;font-size:29px;font-weight:400;color:#2a2420;">Ready to Book? Start Here</h1>
<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>
<p style="${text}">Hi ${esc(first)},</p>
<p style="${text}">Thank you for your interest in North Star House. When you're ready to reserve your date, the next step is our short pre-booking form. It tells us about you and your event so we can prepare your agreement.</p>
<p style="${text}">There's no obligation. Your date isn't held until the agreement is signed.</p>
<div style="margin:26px 0 12px;text-align:center;"><a href="${link}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:16px 32px;">Fill Out the Pre-Booking Form</a></div>
<p style="${text}text-align:center;font-size:13px;">Want a refresher first? <a href="${GUIDEBOOK_URL}" style="color:${GOLD};">Read the Client Guidebook</a>.</p>
<p style="margin:24px 0 0;text-align:center;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email. We're happy to help.</i></p>
</div></div></div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    const { response_id, resend } = await req.json()
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
    const body = `Hi ${first},\n\nThank you for your interest in North Star House. When you're ready to reserve your date, the next step is our short pre-booking form. It tells us about you and your event so we can prepare your agreement.\n\nThere's no obligation. Your date isn't held until the agreement is signed.\n\nFill out the pre-booking form: ${link}\n\nWant a refresher first? Client Guidebook: ${GUIDEBOOK_URL}\n\nQuestions? Just reply to this email.\n\nNorth Star House`
    const mail = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to: email, subject: 'Your North Star House pre-booking form', body, html: emailHtml(first, link), sender: 'Venue Team', fromEmail: 'venue@northstarhouse.org' }),
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
