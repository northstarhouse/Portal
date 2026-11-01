// Backs the Portal's money records up to the treasurer's Google Sheet.
//
// RULE: the Sheet's FIRST tab is never read-modified, cleared or written. Every write goes to a tab this function
// creates itself (always added after the existing tabs), and a write to the first tab is refused.
//
// Two kinds of tabs:
//   * Payment ledger tabs, add-only: "Backup - PayPal Payments" and "Backup - Checks, Cash & Other". Only payments that
//     are not in the Sheet yet are appended (payment_backup_log remembers which). Existing rows are never edited.
//   * Yearly snapshot tabs, one per Financial Overview tab and year (e.g. "Backup - Donations 2026"). The Portal sends
//     the numbers it shows; each of these tabs is replaced with the latest copy.
//
// The Sheet must be shared (Editor) with the Google service account in the GOOGLE_SERVICE_ACCOUNT_KEY secret.
// POST bodies:
//   {}                                   -> append new ledger payments (safe for the schedule to call; returns only counts)
//   { action: 'snapshot', tabs: [...] }  -> signed-in Portal session only; tabs: [{ name, headers, rows }]
//   { action: 'whoami' }                 -> which address to share the Sheet with (signed-in Portal session only)

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SA_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
const SHEET_ID = '1jnZXxpyAusrTAJSMxFQpdT5seb-d7mFVjEnBp3VrxLQ'
const PREFIX = 'Backup - '
const PAYPAL_TAB = PREFIX + 'PayPal Payments'
const OTHER_TAB = PREFIX + 'Checks, Cash & Other'
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

type Meta = { sheetId: number; title: string; index: number }
async function listTabs(token: string): Promise<Meta[]> {
  const meta = await sheets(token, '?fields=sheets.properties(sheetId,title,index)')
  return (meta.sheets || []).map((s: { properties: Meta }) => s.properties)
}

// Only ever returns a tab this function owns. Creates it (after all existing tabs) when missing.
async function ownTab(token: string, title: string, tabs: Meta[]): Promise<Meta> {
  if (!title.startsWith(PREFIX)) throw new Error('Refusing to write outside the backup tabs')
  const first = [...tabs].sort((a, b) => a.index - b.index)[0]
  if (first && first.title === title) throw new Error(`Refusing to write to the first tab ("${title}")`)
  const found = tabs.find((t) => t.title === title)
  if (found) return found
  const res = await sheets(token, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }] }),
  })
  const p = res.replies[0].addSheet.properties as Meta
  tabs.push(p)
  return p
}

const q = (title: string) => encodeURIComponent(`'${title.replace(/'/g, "''")}'`)

// Cleans a tab name the way Sheets wants it (no : \ / ? * [ ], max 100 characters).
const tabName = (n: string) => (PREFIX + String(n).replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 100)

async function ensureHeader(token: string, title: string) {
  const head = await sheets(token, `/values/${q(title)}!A1:L1`)
  if (!head.values || !head.values.length) {
    await sheets(token, `/values/${q(title)}!A1:L1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [HEADER] }) })
  }
}

async function signedIn(req: Request) {
  const ok = await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': req.headers.get('x-app-token') || '' }, body: '{}' })
  return ok === true
}

// PayPal payments (the website's PayPal checkout, and gifts the Portal marks as "Website") vs. everything else.
const isPayPal = (p: Record<string, unknown>) => ['PayPal', 'Website'].includes(String(p.method || ''))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!SA_KEY) return json({ error: 'Google service account is not configured' }, 503)
    const body = await req.json().catch(() => ({}))

    if (body.action === 'whoami') {
      if (!(await signedIn(req))) return json({ error: 'Please sign in again.' }, 401)
      return json({ email: JSON.parse(SA_KEY).client_email })
    }

    const token = await sheetsToken()
    const tabs = await listTabs(token)

    // ---- yearly snapshot tabs: replaced with the latest copy
    if (body.action === 'snapshot') {
      if (!(await signedIn(req))) return json({ error: 'Please sign in again.' }, 401)
      const incoming: { name: string; headers: string[]; rows: Record<string, unknown>[] }[] = Array.isArray(body.tabs) ? body.tabs : []
      let written = 0
      for (const t of incoming) {
        const title = tabName(t.name)
        const tab = await ownTab(token, title, tabs)
        const values = [t.headers, ...t.rows.map((r) => t.headers.map((h) => (r[h] == null ? '' : r[h])))]
        await sheets(token, `/values/${q(title)}:clear`, { method: 'POST', body: '{}' })
        // 10,000 rows per request keeps the payload small; snapshots are far below this anyway.
        for (let i = 0; i < values.length; i += 10000) {
          const chunk = values.slice(i, i + 10000)
          await sheets(token, `/values/${q(title)}!A${i + 1}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: chunk }) })
        }
        void tab
        written++
      }
      return json({ tabs: written })
    }

    // ---- add-only ledger tabs
    await ownTab(token, PAYPAL_TAB, tabs)
    await ownTab(token, OTHER_TAB, tabs)
    await ensureHeader(token, PAYPAL_TAB)
    await ensureHeader(token, OTHER_TAB)
    const [ledger, done]: [Record<string, unknown>[], { payment_key: string }[]] = await Promise.all([
      rest('rpc/treasurer_payments_all', { method: 'POST', body: '{}' }),
      rest('payment_backup_log?select=payment_key&limit=100000'),
    ])
    const have = new Set(done.map((d) => d.payment_key))
    const fresh = ledger.filter((p) => !have.has(String(p.payment_key))).sort((a, b) => String(a.paid_on || '').localeCompare(String(b.paid_on || '')))
    if (!fresh.length) return json({ added: 0, paypal: 0, other: 0 })

    const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const counts = { paypal: 0, other: 0 }
    for (const [title, key, pick] of [[PAYPAL_TAB, 'paypal', true], [OTHER_TAB, 'other', false]] as [string, 'paypal' | 'other', boolean][]) {
      const mine = fresh.filter((p) => isPayPal(p) === pick)
      for (let i = 0; i < mine.length; i += 200) {
        const chunk = mine.slice(i, i + 200)
        const values = chunk.map((p) => [p.payment_key, p.paid_on, p.source, p.category, p.payer, p.detail ?? '', Number(p.amount), p.fee ?? '', p.net ?? '', p.method, p.reference ?? '', stamp])
        await sheets(token, `/values/${q(title)}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) })
        // Remember them only after Google accepted the rows, so a failure retries instead of losing payments.
        await rest('payment_backup_log', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(chunk.map((p) => ({ payment_key: p.payment_key }))) })
        counts[key] += chunk.length
      }
    }
    return json({ added: counts.paypal + counts.other, ...counts })
  } catch (e) {
    return json({ error: (e as Error).message || 'Backup failed' }, 500)
  }
})
