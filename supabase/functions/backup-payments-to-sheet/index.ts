// Backs every payment up to the treasurer's Google Sheet, one row per payment.
// Reads the ledger (treasurer_payments_all), appends only payments that are not in the Sheet yet (payment_backup_log
// remembers which), and never edits or deletes existing rows. Runs from a cron every few hours and from the
// "Back up now" button on the Portal's Treasurer page.
//
// The Sheet must be shared (Editor) with the Google service account in the GOOGLE_SERVICE_ACCOUNT_KEY secret.
// POST { action?: 'whoami' } -> { email } tells you which address to share it with (signed-in Portal session only).

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SA_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
const SHEET_ID = '1jnZXxpyAusrTAJSMxFQpdT5seb-d7mFVjEnBp3VrxLQ'
const TAB = 'Payments'
const HEADER = ['Payment ID', 'Date', 'Source', 'Category', 'From', 'Details', 'Amount', 'PayPal fee', 'Net', 'Method', 'Reference', 'Backed up']
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

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

function b64url(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sheetsToken(): Promise<string> {
  const sa = JSON.parse(SA_KEY!)
  const now = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const input = `${b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })))}`
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input)))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${input}.${b64url(sig)}`,
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Google sign-in failed (${r.status}): ${d.error_description || d.error || ''}`)
  return d.access_token
}

async function sheets(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const d = await r.json().catch(() => ({}))
  if (r.status === 403 || r.status === 404) {
    const email = JSON.parse(SA_KEY!).client_email
    throw new Error(`The Google Sheet is not shared with the backup account. Share it (Editor) with ${email}.`)
  }
  if (!r.ok) throw new Error(d?.error?.message || `Google Sheets error (${r.status})`)
  return d
}

// Make sure the Payments tab and its header row exist.
async function ensureTab(token: string) {
  const meta = await sheets(token, '?fields=sheets.properties.title')
  const has = (meta.sheets || []).some((s: { properties: { title: string } }) => s.properties.title === TAB)
  if (!has) await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } } }] }) })
  const head = await sheets(token, `/values/${encodeURIComponent(TAB)}!A1:L1`)
  if (!head.values || !head.values.length) {
    await sheets(token, `/values/${encodeURIComponent(TAB)}!A1:L1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [HEADER] }) })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!SA_KEY) return json({ error: 'Google service account is not configured' }, 503)
    const body = await req.json().catch(() => ({}))

    if (body.action === 'whoami') {
      const ok = await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': req.headers.get('x-app-token') || '' }, body: '{}' })
      if (ok !== true) return json({ error: 'Please sign in again.' }, 401)
      return json({ email: JSON.parse(SA_KEY).client_email })
    }

    // Adds only what is missing and returns nothing but a count, so it is safe for the schedule to call it.
    const token = await sheetsToken()
    await ensureTab(token)
    const [ledger, done]: [Record<string, unknown>[], { payment_key: string }[]] = await Promise.all([
      rest('rpc/treasurer_payments_all', { method: 'POST', body: '{}' }),
      rest('payment_backup_log?select=payment_key&limit=100000'),
    ])
    const have = new Set(done.map((d) => d.payment_key))
    const fresh = ledger.filter((p) => !have.has(String(p.payment_key))).sort((a, b) => String(a.paid_on || '').localeCompare(String(b.paid_on || '')))
    if (!fresh.length) return json({ added: 0 })

    const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    for (let i = 0; i < fresh.length; i += 200) {
      const chunk = fresh.slice(i, i + 200)
      const values = chunk.map((p) => [p.payment_key, p.paid_on, p.source, p.category, p.payer, p.detail ?? '', Number(p.amount), p.fee ?? '', p.net ?? '', p.method, p.reference ?? '', stamp])
      await sheets(token, `/values/${encodeURIComponent(TAB)}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) })
      // Remember them only after Google accepted the rows, so a failure retries instead of losing payments.
      await rest('payment_backup_log', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(chunk.map((p) => ({ payment_key: p.payment_key }))) })
    }
    return json({ added: fresh.length })
  } catch (e) {
    return json({ error: (e as Error).message || 'Backup failed' }, 500)
  }
})
