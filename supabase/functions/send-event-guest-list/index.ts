// Emails the official guest list for one event (by ticket_orders.event_slug)
// to the admin inbox: every buyer's name split into last/first, ticket
// counts summed per buyer (in case of repeat orders), sorted alphabetically
// by last name. Invoked on a schedule by pg_cron (see the
// send_magic_show_guest_lists migration) with a JSON body of
// { eventSlug: "..." }, or can be called ad-hoc the same way.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_EMAIL = 'media@thenorthstarhouse.org'
// Optional extra recipients, restricted to this list: this endpoint is callable with the public key and the list contains guest names.
const ALLOWED_RECIPIENTS = new Set([ADMIN_EMAIL, 'development@thenorthstarhouse.org', 'gkopec333@gmail.com', 'sanders_pennvalley@comcast.net'])

function splitName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: 'Unknown' }
  if (parts.length === 1) return { first: '', last: parts[0] }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

function escapeHtml(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

Deno.serve(async (req) => {
  try {
    const { eventSlug, to } = await req.json().catch(() => ({}))
    if (!eventSlug) return new Response(JSON.stringify({ error: 'eventSlug required' }), { status: 400 })
    const recipients: string[] = Array.isArray(to) && to.length ? to.map((e: unknown) => String(e).trim().toLowerCase()) : [ADMIN_EMAIL]
    if (recipients.some((e) => !ALLOWED_RECIPIENTS.has(e))) return new Response(JSON.stringify({ error: 'recipient not allowed' }), { status: 400 })

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ticket_orders?select=buyer_name,buyer_email,paypal_payer_name,quantity,event_title,event_date&event_slug=eq.${encodeURIComponent(eventSlug)}&status=eq.completed`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    if (!res.ok) throw new Error(`ticket_orders fetch failed: HTTP ${res.status}`)
    const rows: any[] = await res.json()

    const eventTitle = rows[0]?.event_title || eventSlug
    const eventDate = rows[0]?.event_date || ''

    const byBuyer = new Map<string, { name: string; qty: number }>()
    for (const r of rows) {
      const name = String(r.buyer_name || r.paypal_payer_name || 'Unknown').trim()
      const key = String(r.buyer_email || name).toLowerCase()
      const existing = byBuyer.get(key)
      if (existing) existing.qty += Number(r.quantity) || 0
      else byBuyer.set(key, { name, qty: Number(r.quantity) || 0 })
    }

    const list = [...byBuyer.values()]
      .map(({ name, qty }) => ({ ...splitName(name), qty }))
      .sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first))

    const totalTickets = list.reduce((s, p) => s + p.qty, 0)
    const subject = `${eventTitle} — ${eventDate} — Guest List (${list.length} parties, ${totalTickets} tickets)`

    const textLines = list.map((p) => `${p.last}, ${p.first} - ${p.qty}`).join('\n')
    const body = list.length
      ? `Guest list for ${eventTitle} — ${eventDate}\n${list.length} parties, ${totalTickets} total tickets\n\n${textLines}`
      : `No completed orders were found for ${eventTitle} (${eventSlug}).`

    const htmlRows = list.map((p) => `<tr><td style="padding:3px 16px 3px 0;">${escapeHtml(p.last)}, ${escapeHtml(p.first)}</td><td style="padding:3px 0;text-align:right;">${p.qty}</td></tr>`).join('')
    const html = `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;">
        <strong>${escapeHtml(eventTitle)}</strong> — ${escapeHtml(eventDate)}<br>
        ${list.length} parties, ${totalTickets} total tickets
      </p>
      <table style="font-family:Helvetica,Arial,sans-serif;font-size:13px;border-collapse:collapse;">${htmlRows}</table>`

    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to: recipients, subject, body, html, sender: 'Box Office' }),
    })
    const sendData = await sendRes.json().catch(() => ({}))
    if (!sendRes.ok) throw new Error(sendData.error || `send-email HTTP ${sendRes.status}`)

    return new Response(JSON.stringify({ ok: true, eventSlug, parties: list.length, totalTickets }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
