// Copies PayPal's own transaction list into public.paypal_transactions (payments in, with PayPal's real fee and net).
// Uses the PAYPAL_REPORT_CLIENT_ID / PAYPAL_REPORT_SECRET secrets (a live PayPal app with "Transaction Search").
//
// POST {}                          -> the last 14 days (what the schedule runs)
// POST { since: 'YYYY-MM-DD' }     -> everything from that date (run once to backfill)
// Returns only counts, so it is safe for the schedule to call. PayPal can take a few hours to list a new payment.

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PP_ID = Deno.env.get('PAYPAL_REPORT_CLIENT_ID') || ''
const PP_SECRET = Deno.env.get('PAYPAL_REPORT_SECRET') || ''
const PP = 'https://api-m.paypal.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const DAY = 86400000

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`)
  return data
}

async function ppToken() {
  const r = await fetch(`${PP}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${PP_ID}:${PP_SECRET}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`PayPal sign-in failed (${r.status}): ${d.error_description || d.error || ''}`)
  return d.access_token as string
}

const laDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

// deno-lint-ignore no-explicit-any
function toRow(t: any) {
  const ti = t.transaction_info || {}
  const gross = Number(ti.transaction_amount?.value)
  if (!ti.transaction_id || !ti.transaction_initiation_date || !(gross > 0)) return null // payments in only
  if (ti.transaction_status && ti.transaction_status !== 'S') return null // completed only
  const fee = Math.abs(Number(ti.fee_amount?.value || 0))
  const pn = t.payer_info?.payer_name || {}
  const items = (t.cart_info?.item_details || []).map((i: { item_name?: string }) => i.item_name).filter(Boolean).join('; ')
  return {
    transaction_id: ti.transaction_id,
    occurred_at: ti.transaction_initiation_date,
    paid_on: laDay(ti.transaction_initiation_date),
    gross,
    fee,
    net: Math.round((gross - fee) * 100) / 100,
    currency: ti.transaction_amount?.currency_code || 'USD',
    status: ti.transaction_status || null,
    event_code: ti.transaction_event_code || null,
    payer_name: pn.alternate_full_name || [pn.given_name, pn.surname].filter(Boolean).join(' ') || null,
    payer_email: t.payer_info?.email_address || null,
    subject: ti.transaction_subject || null,
    note: ti.transaction_note || null,
    items: items || null,
    invoice_id: ti.invoice_id || null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!PP_ID || !PP_SECRET) return json({ error: 'PayPal reporting credentials are not set' }, 503)
    const body = await req.json().catch(() => ({}))
    const end = Date.now()
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.since || '')) ? new Date(body.since + 'T00:00:00Z').getTime() : end - 14 * DAY
    const token = await ppToken()
    let seen = 0, saved = 0

    // PayPal allows at most 31 days per request, so walk forward in 30-day windows.
    for (let from = start; from < end; from += 30 * DAY) {
      const to = Math.min(from + 30 * DAY, end)
      let page = 1, pages = 1
      while (page <= pages) {
        const qs = `start_date=${new Date(from).toISOString().slice(0, 19)}Z&end_date=${new Date(to).toISOString().slice(0, 19)}Z&fields=transaction_info,payer_info,cart_info&page_size=500&page=${page}`
        const r = await fetch(`${PP}/v1/reporting/transactions?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(`PayPal transaction search failed (${r.status}): ${d.message || d.name || ''}${d.details ? ' ' + JSON.stringify(d.details).slice(0, 200) : ''}`)
        pages = d.total_pages || 1
        const rows = (d.transaction_details || []).map(toRow).filter(Boolean)
        seen += (d.transaction_details || []).length
        if (rows.length) {
          await rest('paypal_transactions?on_conflict=transaction_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) })
          saved += rows.length
        }
        page++
      }
    }
    // Save PayPal's real fee and net on the Portal's own records (orders, venue payments, matched gifts).
    const applied = await rest('rpc/apply_paypal_fees', { method: 'POST', body: '{}' })
    return json({ looked_at: seen, payments_saved: saved, ...applied })
  } catch (e) {
    return json({ error: (e as Error).message || 'Sync failed' }, 500)
  }
})
