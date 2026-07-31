const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { to, bcc, subject, body, html, sender } = await req.json()

    const recipients: string[] = Array.isArray(to)
      ? to
      : String(to || '').split(',').map((e: string) => e.trim()).filter(Boolean)

    if (!recipients.length) {
      return new Response(JSON.stringify({ error: 'No recipients' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const bccList: string[] = bcc
      ? (Array.isArray(bcc) ? bcc : String(bcc).split(',').map((e: string) => e.trim()).filter(Boolean))
      : []

    const fromName = sender ? `${sender} · North Star House` : 'North Star House'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <info@northstarhouse.org>`,
        to: recipients,
        subject,
        text: body || '',
        ...(html ? { html } : {}),
        ...(bccList.length ? { bcc: bccList } : {}),
      }),
    })

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
