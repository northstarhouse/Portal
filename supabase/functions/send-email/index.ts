const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
}

// Every email this function sends gets this bcc'd in, regardless of what
// the caller passes -- so admin always has a copy of every outgoing email
// without every call site having to remember to add it.
const ADMIN_BCC = 'media@thenorthstarhouse.org'

// Default sending address (domain verified with Resend). Callers may ask for one of the
// ALLOWED_FROM addresses via `fromEmail`; if Resend refuses it (e.g. its domain isn't
// verified yet) we resend from the default with the requested address as Reply-To,
// so an email is never lost over the sender address.
const DEFAULT_FROM = 'info@northstarhouse.org'
const ALLOWED_FROM = new Set(['venue@thenorthstarhouse.org'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { to, cc, bcc, subject, body, html, sender, fromEmail } = await req.json()
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
    const bccList: string[] = Array.from(new Set([ADMIN_BCC, ...callerBcc]))

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
        ...(html ? { html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(ccList.length ? { cc: ccList } : {}),
        ...(bccList.length ? { bcc: bccList } : {}),
      }),
    })

    let res = await send(wantedFrom || DEFAULT_FROM, wantedFrom)
    if (!res.ok && wantedFrom) {
      console.error('send-email: sender rejected, falling back to default', wantedFrom, res.status)
      res = await send(DEFAULT_FROM, wantedFrom)
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
