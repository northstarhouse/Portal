const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
}

// Every email this function sends gets this bcc'd in, regardless of what
// the caller passes -- so admin always has a copy of every outgoing email
// without every call site having to remember to add it.
const ADMIN_BCC = 'media@thenorthstarhouse.org'

// Default sending address (northstarhouse.org is the domain verified with Resend). Callers may
// ask for one of the ALLOWED_FROM addresses via `fromEmail`; those are sent with Reply-To set to
// VENUE_REPLY_TO. If Resend refuses the requested sender we resend from the default, so an
// email is never lost over the sender address.
const DEFAULT_FROM = 'info@northstarhouse.org'
const ALLOWED_FROM = new Set(['venue@northstarhouse.org'])
const VENUE_REPLY_TO = 'venue@thenorthstarhouse.org'
// Wedding/private-event emails are also copied (bcc) to the venue inbox.
const VENUE_BCC = 'venue@thenorthstarhouse.org'

// Plain-text emails addressed to the venue inbox (client messages, booking notices, codes) get
// the same branded look as client emails. Callers that pass their own html are left alone.
const LOGO_URL = 'https://northstarhouse.github.io/venue/assets/logo.png'
const escHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function brandPlain(subject: string, text: string) {
  const inner = text.split(/\n{2,}/).map((p) => '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">'
    + escHtml(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#886c44;">$1</a>').replace(/\n/g, '<br>') + '</p>').join('')
  return `<div style="background:#f7f3ec;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e8e0d5;overflow:hidden;">
<div style="background:#6b5232;padding:22px;text-align:center;"><img src="${LOGO_URL}" alt="North Star House" width="170" style="display:block;margin:0 auto;max-width:170px;height:auto;"></div>
<div style="height:4px;background:#886c44;"></div>
<div style="padding:30px 36px;"><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#2a2420;">${escHtml(subject)}</h1>${inner}</div>
<div style="background:#f7f3ec;padding:16px 36px;border-top:1px solid #e8e0d5;text-align:center;font-size:11px;color:#999;">North Star House</div></div></div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { to, cc, bcc, subject, body, html, sender, fromEmail, replyTo: replyToRaw } = await req.json()
    // Optional Reply-To (e.g. a client's address when their message is forwarded to the team).
    const callerReplyTo = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(replyToRaw || '')) ? String(replyToRaw).trim() : null
    const wantedFrom = ALLOWED_FROM.has(String(fromEmail || '').toLowerCase()) ? String(fromEmail).toLowerCase() : null

    const recipients: string[] = Array.isArray(to)
      ? to
      : String(to || '').split(',').map((e: string) => e.trim()).filter(Boolean)

    if (!recipients.length) {
      return new Response(JSON.stringify({ error: 'No recipients' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const ccList: string[] = cc
      ? (Array.isArray(cc) ? cc : String(cc).split(',').map((e: string) => e.trim()).filter(Boolean))
      : []

    const callerBcc: string[] = bcc
      ? (Array.isArray(bcc) ? bcc : String(bcc).split(',').map((e: string) => e.trim()).filter(Boolean))
      : []
    const bccList: string[] = Array.from(new Set([ADMIN_BCC, ...callerBcc, ...(wantedFrom ? [VENUE_BCC] : [])]))

    const toVenue = [...recipients, ...ccList].some((e) => e.toLowerCase() === VENUE_BCC)
    const finalHtml = html || (toVenue ? brandPlain(String(subject || ''), String(body || '')) : '')

    const fromName = sender ? `${sender} · North Star House` : 'North Star House'

    const send = (fromAddr: string, replyTo: string | null) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`,
        to: recipients,
        subject,
        text: body || '',
        ...(finalHtml ? { html: finalHtml } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(ccList.length ? { cc: ccList } : {}),
        ...(bccList.length ? { bcc: bccList } : {}),
      }),
    })

    const replyTo = callerReplyTo || (wantedFrom ? VENUE_REPLY_TO : null)
    let res = await send(wantedFrom || DEFAULT_FROM, replyTo)
    if (!res.ok && wantedFrom) {
      console.error('send-email: sender rejected, falling back to default', wantedFrom, res.status)
      res = await send(DEFAULT_FROM, replyTo)
    }

    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
