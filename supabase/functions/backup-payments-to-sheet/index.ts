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
// The PayPal tab follows the layout the treasurer uses on the first tab: fee and net get their own columns.
const PP_HEADER = ['Name', 'Gross', 'Fee', 'Net', 'Date', 'Notes', 'For:']
const niceDate = (d: unknown) => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : String(d || '')
}
const ppRow = (p: Record<string, unknown>) => {
  const gross = Number(p.amount)
  const saved = p.fee != null && p.fee !== ''
  const known = saved && !p.fee_estimated
  // PayPal's nonprofit rate (1.99% + $0.49) reproduces every fee on record to the cent; used only when the real fee was not saved.
  const fee = saved ? Number(p.fee) : Math.round((gross * 0.0199 + 0.49) * 100) / 100
  const net = saved && p.net != null && p.net !== '' ? Number(p.net) : Math.round((gross - fee) * 100) / 100
  const note = [p.reference, known ? '' : 'fee estimated'].filter(Boolean).join(' · ')
  return [p.payer, gross, fee, net, niceDate(p.paid_on), note, [p.category, p.detail].filter(Boolean).join(' — ')]
}
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
    throw new Error(`Google said (${r.status}): ${d?.error?.message || "no detail"}. Backup account: ${email}`)
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

// Writes the header row if the tab is empty. Returns true when the tab had a different (older) layout and was reset, so
// the caller can re-add its payments. Only ever called on backup tabs this function owns.
async function ensureHeader(token: string, title: string, header: string[], force = false) {
  const head = await sheets(token, `/values/${q(title)}!A1:L1`)
  const have = (head.values && head.values[0]) || []
  const same = !force && have.length === header.length && header.every((h, i) => have[i] === h)
  let reset = false
  if (have.length && !same) {
    const tab = (await listTabs(token)).find((t) => t.title === title)
    if (tab) {
      if (!title.startsWith(PREFIX)) throw new Error('Refusing to rebuild a tab outside the backup tabs')
      await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [
        { addSheet: { properties: { title: title + ' (new)', gridProperties: { frozenRowCount: 1 } } } },
        { deleteSheet: { sheetId: tab.sheetId } },
      ] }) })
      const fresh = (await listTabs(token)).find((t) => t.title === title + ' (new)')
      if (fresh) await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: fresh.sheetId, title }, fields: 'title' } }] }) })
    }
    reset = true
  }
  if (!same) await sheets(token, `/values/${q(title)}!A1:${String.fromCharCode(64 + header.length)}1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [header] }) })
  return reset
}

async function signedIn(req: Request) {
  const ok = await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': req.headers.get('x-app-token') || '' }, body: '{}' })
  return ok === true
}

// PayPal payments (the website's PayPal checkout, and gifts the Portal marks as "Website") vs. everything else.
const isPayPal = (p: Record<string, unknown>) => ['PayPal', 'Website'].includes(String(p.method || ''))

// ---------- yearly tabs (the same tabs as Financial Overview, built here so they stay current by themselves) ----------
// Budgets per operational area (same figures the Portal shows).
const AREA_BUDGETS: Record<string, number | null> = { Construction: 12000, Grounds: 14000, Interiors: 2500, Docents: 1000, Fundraising: null, Events: 7500, Marketing: 1000, Venue: null }

// deno-lint-ignore no-explicit-any
async function allRows(path: string): Promise<any[]> {
  const out: any[] = []
  for (let offset = 0; ; offset += 1000) {
    const page = await rest(`${path}${path.includes('?') ? '&' : '?'}limit=1000&offset=${offset}`)
    out.push(...(page || []))
    if (!page || page.length < 1000) break
  }
  return out
}
const num = (v: unknown) => parseFloat(String(v ?? '')) || 0
const byDateDesc = (a: { date?: string }, b: { date?: string }) => String(b.date || '').localeCompare(String(a.date || ''))
type Tab = { name: string; headers: string[]; rows: Record<string, unknown>[] }

async function buildYearlyTabs(year: number): Promise<Tab[]> {
  const inYear = (d: unknown) => !!d && String(d).slice(0, 4) === String(year)
  const enc = encodeURIComponent
  const [donations, donors, sponsors, budget, earnings, cashLog, rentals, inKind, ledger] = await Promise.all([
    allRows('donations?select=amount,date,type,donor_id,payment_type,donation_notes'),
    allRows('donors?select=id,formal_name'),
    allRows(`${enc('Sponsors')}?select=*`),
    allRows(`${enc('Op Budget')}?select=area,type,amount,date,needs_reimbursement,description,purchased_by,volunteer_name,event_name`),
    allRows(`${enc('Op Earnings')}?select=area,event,earning_source,amount,date`),
    allRows(`${enc('Cash Log')}?select=amount,date,direction,description`),
    allRows(`${enc('Creative Rentals')}?select=amount,date,name`),
    allRows(`${enc('Sponsor In-Kind')}?select=*`),
    rest('rpc/treasurer_payments_all', { method: 'POST', body: '{}' }),
  ])
  const tabs: Tab[] = []
  const donorName: Record<string, string> = {}
  donors.forEach((d) => { donorName[d.id] = d.formal_name })

  // Donations
  tabs.push({
    name: `Donations ${year}`, headers: ['Date', 'Donor', 'Type', 'Payment Type', 'Notes', 'Amount'],
    rows: donations.filter((d) => inYear(d.date)).map((d) => ({ Date: d.date || '', Donor: donorName[d.donor_id] || 'Unknown donor', Type: d.type || '', 'Payment Type': d.payment_type || '', Notes: d.donation_notes || '', Amount: num(d.amount) })),
  })

  // Sponsorships (current sponsors only)
  const current = sponsors.filter((s) => (s['sponsor_status'] || 'current') === 'current')
  const sponsorRows: Record<string, unknown>[] = []
  current.forEach((sp) => {
    inKind.filter((e) => e.sponsor_id === sp.id && inYear(e.date)).forEach((e) => {
      sponsorRows.push({ Business: sp['Business Name'] || '', Date: e.date || '', Type: e.contribution_type || '', Description: e.description || '', Value: num(e.value) })
    })
  })
  tabs.push({ name: `Sponsorships ${year}`, headers: ['Business', 'Date', 'Type', 'Description', 'Value'], rows: sponsorRows })

  // Operational Areas
  const yBudget = budget.filter((b) => inYear(b.date)), yEarn = earnings.filter((e) => inYear(e.date))
  const byArea: Record<string, { area: string; purchases: number; inKind: number; earnings: number; allocated: number | null }> = {}
  const bucket = (a: string | null) => { const k = a || 'Unassigned'; return byArea[k] ||= { area: k, purchases: 0, inKind: 0, earnings: 0, allocated: AREA_BUDGETS[k] ?? null } }
  yBudget.forEach((b) => { if (b.type === 'In-Kind') bucket(b.area).inKind += num(b.amount); else bucket(b.area).purchases += num(b.amount) })
  yEarn.forEach((e) => { bucket(e.area).earnings += num(e.amount) })
  const areaRows = Object.values(byArea).sort((a, b) => (a.allocated != null ? a.allocated - a.purchases : Infinity) - (b.allocated != null ? b.allocated - b.purchases : Infinity))
  tabs.push({
    name: `Operational Areas ${year}`, headers: ['Area', 'Budget', 'Spent', 'Earnings', 'In-Kind', 'Remaining'],
    rows: areaRows.map((r) => ({ Area: r.area, Budget: r.allocated != null ? r.allocated : '', Spent: r.purchases, Earnings: r.earnings, 'In-Kind': r.inKind, Remaining: r.allocated != null ? r.allocated - r.purchases : '' })),
  })
  const areaItems: Record<string, unknown>[] = []
  areaRows.forEach((r) => {
    const items = [
      ...yBudget.filter((b) => (b.area || 'Unassigned') === r.area).map((b) => ({ kind: b.type === 'In-Kind' ? 'In-Kind' : 'Purchase', description: b.description || '—', by: b.purchased_by || (b.needs_reimbursement ? b.volunteer_name : null), amount: num(b.amount), date: b.date })),
      ...yEarn.filter((e) => (e.area || 'Unassigned') === r.area).map((e) => ({ kind: 'Earning', description: e.event || '—', by: null, amount: num(e.amount), date: e.date })),
    ].sort(byDateDesc)
    items.forEach((i) => areaItems.push({ Name: r.area, Date: i.date || '', Kind: i.kind, Description: i.description, By: i.by || '', Amount: i.amount }))
  })
  tabs.push({ name: `Operational Areas Items ${year}`, headers: ['Name', 'Date', 'Kind', 'Description', 'By', 'Amount'], rows: areaItems })

  // Events
  const evBudget = yBudget.filter((b) => b.area === 'Events'), evEarn = yEarn.filter((e) => e.area === 'Events')
  const byEvent: Record<string, { event: string; expenses: number; inKind: number; earnings: number }> = {}
  const ebucket = (n: string | null) => { const k = n || 'Unassigned / General Events'; return byEvent[k] ||= { event: k, expenses: 0, inKind: 0, earnings: 0 } }
  evBudget.forEach((b) => { if (b.type === 'In-Kind') ebucket(b.event_name).inKind += num(b.amount); else ebucket(b.event_name).expenses += num(b.amount) })
  evEarn.forEach((e) => { ebucket(e.event).earnings += num(e.amount) })
  const eventRows = Object.values(byEvent).sort((a, b) => b.earnings - a.earnings)
  tabs.push({
    name: `Events ${year}`, headers: ['Event', 'Expenses', 'Earnings', 'In-Kind', 'Profit / Loss'],
    rows: eventRows.map((r) => ({ Event: r.event, Expenses: r.expenses, Earnings: r.earnings, 'In-Kind': r.inKind, 'Profit / Loss': r.earnings - r.expenses })),
  })
  const eventItems: Record<string, unknown>[] = []
  eventRows.forEach((r) => {
    const items = [
      ...evBudget.filter((b) => (b.event_name || 'Unassigned / General Events') === r.event).map((b) => ({ kind: b.type === 'In-Kind' ? 'In-Kind' : 'Expense', description: b.description || '—', by: b.purchased_by || (b.needs_reimbursement ? b.volunteer_name : null), amount: num(b.amount), date: b.date })),
      ...evEarn.filter((e) => (e.event || 'Unassigned / General Events') === r.event).map((e) => ({ kind: 'Earning', description: e.earning_source || '—', by: null, amount: num(e.amount), date: e.date })),
    ].sort(byDateDesc)
    items.forEach((i) => eventItems.push({ Name: r.event, Date: i.date || '', Kind: i.kind, Description: i.description, By: i.by || '', Amount: i.amount }))
  })
  tabs.push({ name: `Events Items ${year}`, headers: ['Name', 'Date', 'Kind', 'Description', 'By', 'Amount'], rows: eventItems })

  // Venue Rentals (payments received, from the treasurer ledger)
  tabs.push({
    name: `Venue Rentals ${year}`, headers: ['Date', 'Client', 'Event', 'Payment', 'Amount', 'PayPal Fee', 'Net', 'Method'],
    rows: (ledger as Record<string, unknown>[]).filter((p) => p.source === 'Venue Rental' && inYear(p.paid_on)).map((p) => {
      const m = String(p.reference || '').match(/(Part of payment|Payments?) [^·]*/)
      return { Date: p.paid_on || '', Client: p.payer || '', Event: p.detail || '', Payment: m ? m[0].trim() : '', Amount: num(p.amount), 'PayPal Fee': p.fee == null ? '' : num(p.fee), Net: p.net == null ? '' : num(p.net), Method: p.method || '' }
    }),
  })

  // Office Cash Flow
  tabs.push({
    name: `Office Cash Flow ${year}`, headers: ['Date', 'Source', 'Category', 'Direction', 'Amount'],
    rows: [
      ...rentals.filter((r) => inYear(r.date)).map((r) => ({ Date: r.date || '', Source: 'Earning', Category: r.name || 'Other', Direction: 'In', Amount: num(r.amount) })),
      ...cashLog.filter((c) => inYear(c.date)).map((c) => ({ Date: c.date || '', Source: 'Cash Log', Category: c.description || '', Direction: c.direction || '', Amount: num(c.amount) })),
    ],
  })

  // Spending Detail
  const spend = [
    ...yBudget.filter((b) => b.type !== 'In-Kind').map((b) => ({ source: 'Op Budget', area: b.area || 'Unassigned', description: b.description || '—', by: b.purchased_by || (b.needs_reimbursement ? b.volunteer_name : null), amount: num(b.amount), date: b.date, dup: false })),
    ...cashLog.filter((c) => inYear(c.date) && c.direction === 'Out').map((c) => ({ source: 'Cash Log', area: 'Office', description: c.description || '—', by: null, amount: num(c.amount), date: c.date, dup: false })),
  ]
  const keyOf = (r: { source: string; area: string; description: string; amount: number; date: string }) => [r.source, r.area, r.description, r.amount, r.date].join('|')
  const seen: Record<string, number> = {}
  spend.forEach((r) => { seen[keyOf(r)] = (seen[keyOf(r)] || 0) + 1 })
  spend.forEach((r) => { r.dup = seen[keyOf(r)] > 1 })
  spend.sort(byDateDesc)
  tabs.push({
    name: `Spending Detail ${year}`, headers: ['Date', 'Area', 'Description', 'By', 'Source', 'Amount', 'Possible Duplicate'],
    rows: spend.map((r) => ({ Date: r.date || '', Area: r.area, Description: r.description, By: r.by || '', Source: r.source, Amount: r.amount, 'Possible Duplicate': r.dup ? 'Yes' : '' })),
  })
  return tabs
}

// Replaces each yearly tab with the latest copy. Only tabs named "Backup - …" are ever written (never the first tab).
async function writeYearlyTabs(token: string, tabs: Meta[], year: number) {
  for (const t of await buildYearlyTabs(year)) {
    const title = tabName(t.name)
    const own = await ownTab(token, title, tabs)
    const values = [t.headers, ...t.rows.map((r) => t.headers.map((h) => (r[h] == null ? '' : r[h])))]
    // Make sure the tab has room for every row.
    await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: own.sheetId, gridProperties: { rowCount: Math.max(1000, values.length + 50), frozenRowCount: 1 } }, fields: 'gridProperties.rowCount,gridProperties.frozenRowCount' } }] }) })
    await sheets(token, `/values/${q(title)}:clear`, { method: 'POST', body: '{}' })
    for (let i = 0; i < values.length; i += 10000) {
      await sheets(token, `/values/${q(title)}!A${i + 1}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: values.slice(i, i + 10000) }) })
    }
  }
}

// One refresh at a time. Changes that arrive during a refresh are folded into one more pass right after it.
async function runYearlySync(token: string, tabs: Meta[]) {
  const iso = (ms: number) => new Date(ms).toISOString()
  const got = await rest(`sheet_sync_state?id=eq.1&running_until=lt.${encodeURIComponent(iso(Date.now()))}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ running_until: iso(Date.now() + 120000), pending: false }) })
  if (!got || !got.length) {
    await rest('sheet_sync_state?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pending: true }) })
    return { queued: true }
  }
  try {
    for (let pass = 0; pass < 3; pass++) {
      const year = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 4))
      await writeYearlyTabs(token, tabs, year)
      const st = await rest('sheet_sync_state?id=eq.1&select=pending')
      if (!st?.[0]?.pending) break
      await rest('sheet_sync_state?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pending: false }) })
    }
    return { refreshed: true }
  } finally {
    await rest('sheet_sync_state?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ running_until: iso(Date.now() - 1000) }) }).catch(() => {})
  }
}

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

    // ---- yearly Financial Overview tabs, rebuilt from the database (called by the database whenever the records change)
    if (body.action === 'yearly') return json(await runYearlySync(token, tabs))

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
    const ppReset = await ensureHeader(token, PAYPAL_TAB, PP_HEADER, body.rebuild === "paypal")
    await ensureHeader(token, OTHER_TAB, HEADER)
    const [ledger, done]: [Record<string, unknown>[], { payment_key: string }[]] = await Promise.all([
      rest('rpc/treasurer_payments_all', { method: 'POST', body: '{}' }),
      rest('payment_backup_log?select=payment_key&limit=100000'),
    ])
    // The PayPal tab was just rebuilt in the new layout: forget its payments so they are written again.
    if (ppReset) {
      const ppKeys = ledger.filter(isPayPal).map((p) => String(p.payment_key))
      for (let i = 0; i < ppKeys.length; i += 100) {
        await rest(`payment_backup_log?payment_key=in.(${ppKeys.slice(i, i + 100).map((k) => '"' + k + '"').join(',')})`, { method: 'DELETE' })
      }
    }
    const have = new Set(ppReset ? done.map((d) => d.payment_key).filter((k) => !ledger.some((p) => p.payment_key === k && isPayPal(p))) : done.map((d) => d.payment_key))
    const candidates = ledger.filter((p) => !have.has(String(p.payment_key))).sort((a, b) => String(a.paid_on || '').localeCompare(String(b.paid_on || '')))
    if (!candidates.length) return json({ added: 0, paypal: 0, other: 0 })
    // Claim the payments first. If two backups run at once (instant triggers), only one of them gets each payment,
    // so nothing is written to the Sheet twice. A failed write gives its claims back so the next run retries them.
    const claimedRows: { payment_key: string }[] = []
    for (let i = 0; i < candidates.length; i += 200) {
      const got = await rest('payment_backup_log?on_conflict=payment_key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(candidates.slice(i, i + 200).map((p) => ({ payment_key: p.payment_key }))) })
      claimedRows.push(...(got || []))
    }
    const claimed = new Set(claimedRows.map((c) => c.payment_key))
    const fresh = candidates.filter((p) => claimed.has(String(p.payment_key)))
    if (!fresh.length) return json({ added: 0, paypal: 0, other: 0 })
    const written = new Set<string>()

    const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const counts = { paypal: 0, other: 0 }
    try {
    for (const [title, key, pick] of [[PAYPAL_TAB, 'paypal', true], [OTHER_TAB, 'other', false]] as [string, 'paypal' | 'other', boolean][]) {
      const mine = fresh.filter((p) => isPayPal(p) === pick)
      if (pick && mine.length) {
        // The PayPal tab keeps the newest payment on top: slot the new rows in just under the header, newest first.
        const newestFirst = [...mine].sort((a, b) => String(b.paid_on || '').localeCompare(String(a.paid_on || '')))
        const tab = (await listTabs(token)).find((t) => t.title === title)
        if (!tab) throw new Error('PayPal backup tab is missing')
        await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ insertDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + newestFirst.length }, inheritFromBefore: false } }] }) })
        await sheets(token, `/values/${q(title)}!A2?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: newestFirst.map(ppRow) }) })
        for (let i = 0; i < newestFirst.length; i += 200) {
          await rest('payment_backup_log', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(newestFirst.slice(i, i + 200).map((p) => ({ payment_key: p.payment_key }))) })
        }
        newestFirst.forEach((p) => written.add(String(p.payment_key)))
        counts[key] += newestFirst.length
        continue
      }
      for (let i = 0; i < mine.length; i += 200) {
        const chunk = mine.slice(i, i + 200)
        const values = pick ? chunk.map(ppRow) : chunk.map((p) => [p.payment_key, p.paid_on, p.source, p.category, p.payer, p.detail ?? '', Number(p.amount), p.fee ?? '', p.net ?? '', p.method, p.reference ?? '', stamp])
        await sheets(token, `/values/${q(title)}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) })
        // Remember them only after Google accepted the rows, so a failure retries instead of losing payments.
        await rest('payment_backup_log', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(chunk.map((p) => ({ payment_key: p.payment_key }))) })
        chunk.forEach((p) => written.add(String(p.payment_key)))
        counts[key] += chunk.length
      }
    }
    } catch (e) {
      const back = fresh.map((p) => String(p.payment_key)).filter((k) => !written.has(k))
      for (let i = 0; i < back.length; i += 100) await rest(`payment_backup_log?payment_key=in.(${back.slice(i, i + 100).map((k) => '"' + k + '"').join(',')})`, { method: 'DELETE' }).catch(() => {})
      throw e
    }
    return json({ added: counts.paypal + counts.other, ...counts })
  } catch (e) {
    return json({ error: (e as Error).message || 'Backup failed' }, 500)
  }
})
