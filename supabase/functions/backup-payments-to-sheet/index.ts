// Backs the Portal's money records up to the treasurer's Google Sheet.
//
// RULE: the Sheet's FIRST tab is never read-modified, cleared or written. Every write goes to a tab this function
// creates itself (always added after the existing tabs), and a write to the original tab (Sheet1) is refused, wherever that tab sits.
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
const LEGACY_PREFIX = 'Backup - ' // tabs used to be named "Backup - ..."; they are renamed to plain names by the 'rename' action
const PAYPAL_TAB = 'PayPal Payments'
const OTHER_TAB = 'Checks, Cash & Other'
// The only tab names this function may write. Anything else (your original Sheet1, or tabs you add yourself) is never touched.
const YEARLY_NAMES = ['Donations', 'Sponsorships', 'Operational Areas', 'Operational Areas Items', 'Events', 'Events Items', 'Venue Rentals', 'Office Cash Flow', 'Spending Detail']
const isOurTab = (title: string) => title === PAYPAL_TAB || title === OTHER_TAB || YEARLY_NAMES.some((n) => new RegExp('^' + n + ' \\d{4}$').test(title))
const HEADER = ['Date', 'Source', 'Category', 'From', 'Details', 'Amount', 'PayPal fee', 'Net', 'Method', 'Reference', 'Backed up', 'Payment ID'] // Payment ID is always last
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
const ppObj = (p: Record<string, unknown>) => { const a = ppRow(p); return Object.fromEntries(PP_HEADER.map((h, i) => [h, a[i]])) as Record<string, unknown> }
const otherObj = (p: Record<string, unknown>, stamp: string) => ({ Date: p.paid_on, Source: p.source, Category: p.category, From: p.payer, Details: p.detail ?? '', Amount: Number(p.amount), 'PayPal fee': p.fee ?? '', Net: p.net ?? '', Method: p.method, Reference: p.reference ?? '', 'Backed up': stamp, 'Payment ID': p.payment_key }) as Record<string, unknown>
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Google allows about 60 reads a minute. When it says slow down (429), wait for the minute to roll over and try again.
async function sheets(token: string, path: string, init: RequestInit = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 429 && attempt < 4) { await sleep(15000 + attempt * 5000); continue }
    if (r.status === 403 || r.status === 404) {
      const email = JSON.parse(SA_KEY!).client_email
      throw new Error(`Google said (${r.status}): ${d?.error?.message || "no detail"}. Backup account: ${email}`)
    }
    if (!r.ok) throw new Error(d?.error?.message || `Google Sheets error (${r.status})`)
    return d
  }
}

type Meta = { sheetId: number; title: string; index: number }
async function listTabs(token: string): Promise<Meta[]> {
  const meta = await sheets(token, '?fields=sheets.properties(sheetId,title,index)')
  return (meta.sheets || []).map((s: { properties: Meta }) => s.properties)
}

// Only ever returns a tab this function owns. Creates it (after all existing tabs) when missing.
async function ownTab(token: string, title: string, tabs: Meta[]): Promise<Meta> {
  if (!isOurTab(title)) throw new Error('Refusing to write outside the backup tabs')
  // Your original tab (Sheet1, filled by Zapier) is never touched, wherever it sits in the Sheet. Only "Backup - ..." tabs are written.
  const original = tabs.find((t) => t.sheetId === 0 || t.title === "Sheet1")
  if (original && original.title === title) throw new Error(`Refusing to write to the original tab ("${title}")`)
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

const colLetter = (n: number) => { let s = ''; for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s }
const q = (title: string) => encodeURIComponent(`'${title.replace(/'/g, "''")}'`)

// Cleans a tab name the way Sheets wants it (no : \ / ? * [ ], max 100 characters).
const tabName = (n: string) => String(n).replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)

// Writes the header row only when the tab is empty. An existing header is the treasurer's to arrange (column order, extra columns),
// so it is never rebuilt or reordered. Returns true only when a rebuild was explicitly requested.
async function ensureHeader(token: string, title: string, header: string[], force = false) {
  const head = await sheets(token, `/values/${q(title)}!1:1`)
  const have = (head.values && head.values[0]) || []
  let reset = false
  if (have.length && force) {
    const tab = (await listTabs(token)).find((t) => t.title === title)
    if (tab) {
      if (!isOurTab(title)) throw new Error('Refusing to rebuild a tab outside the backup tabs')
      await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [
        { addSheet: { properties: { title: title + ' (new)', index: tab.index, gridProperties: { frozenRowCount: 1 } } } },
        { deleteSheet: { sheetId: tab.sheetId } },
      ] }) })
      const fresh = (await listTabs(token)).find((t) => t.title === title + ' (new)')
      if (fresh) await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: fresh.sheetId, title }, fields: 'title' } }] }) })
    }
    reset = true
  }
  if (!have.length || force) await sheets(token, `/values/${q(title)}!A1:${String.fromCharCode(64 + header.length)}1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [header] }) })
  return reset
}

// The tab's current header row, in the order the treasurer has arranged it.
async function tabHeader(token: string, title: string): Promise<string[]> {
  const r = await sheets(token, `/values/${q(title)}!1:1`)
  const h = ((r.values && r.values[0]) || []).map(String)
  while (h.length && !h[h.length - 1]) h.pop()
  return h
}
// Our row, laid out in whatever column order the tab has now (columns we don't know about stay blank).
const inOrder = (cols: string[], obj: Record<string, unknown>) => cols.map((c) => (obj[c] == null ? '' : obj[c]))

async function signedIn(req: Request) {
  const ok = await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': req.headers.get('x-app-token') || '' }, body: '{}' })
  return ok === true
}

// PayPal payments (the website's PayPal checkout, and gifts the Portal marks as "Website") vs. everything else.
const isPayPal = (p: Record<string, unknown>) => ['PayPal', 'Website'].includes(String(p.method || ''))

// ---------- table look (same as the original tab: a real Sheets table, gold header, banded rows) ----------
const MONEY_COLS = new Set(['Amount', 'Gross', 'Fee', 'Net', 'PayPal Fee', 'PayPal fee', 'Budget', 'Spent', 'Earnings', 'In-Kind', 'Remaining', 'Expenses', 'Profit / Loss', 'Value'])
const RECON = 'Last Reconciled Here' // a checkbox column on every tab, for ticking off what has been checked
const colorStyle = (r: number, g: number, b: number) => ({ rgbColor: { red: r / 255, green: g / 255, blue: b / 255 } })

// Comfortable column widths, wide enough for the header and its dropdown arrow.
function widthFor(h: string): number {
  if (MONEY_COLS.has(h)) return 115
  if (/^(Date|Backed up)$/.test(h)) return 130
  if (/^(Details|Description|For:)$/.test(h)) return 380
  if (/^(Client|Donor|From|Name|Business|Area)$/.test(h)) return 250
  if (/^(Event|Items)$/.test(h)) return 300
  if (/^(Payment ID)$/.test(h)) return 280
  if (/^(Notes|Reference)$/.test(h)) return 200
  return 150
}
const widthRequests = (sheetId: number, headers: string[]) => headers.map((h, i) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: widthFor(h) }, fields: 'pixelSize' } }))

// Makes the tab's data a table (or resizes the table that is already there). A table is never deleted, because deleting it
// deletes its rows. The grid is trimmed to the table, so there are no extra empty rows or columns.
async function styleTable(token: string, title: string, _headers?: string[], withWidths = false, resetTypes = false) {
  if (!isOurTab(title)) throw new Error('Refusing to style a tab outside the backup tabs')
  const headers = await tabHeader(token, title)
  if (!headers.length) return
  const meta = await sheets(token, '?fields=sheets(properties(sheetId,title),tables(tableId,columnProperties))')
  const tab = (meta.sheets || []).find((s: { properties: { title: string } }) => s.properties.title === title)
  if (!tab) return
  const sheetId = tab.properties.sheetId as number
  const colA = await sheets(token, `/values/${q(title)}`) // every column, so the row count never depends on one column
  const rows = Math.max(2, (colA.values || []).length)
  const cols = headers.length
  const requests: unknown[] = []
  const existing = (tab.tables || [])[0]
  const range = { sheetId, startRowIndex: 0, endRowIndex: rows, startColumnIndex: 0, endColumnIndex: cols }
  // Trim (or grow) the grid to the table first, so the table range is always valid.
  requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { rowCount: rows, columnCount: cols, frozenRowCount: 1 } }, fields: 'gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount' } })
  if (existing) {
    // Keep whatever column settings the table already has; give any new column its type (the checkbox column is a checkbox).
    // deno-lint-ignore no-explicit-any
    const cur: any[] = existing.columnProperties || []
    const props = headers.map((h, i) => (resetTypes ? null : cur.find((c) => c.columnIndex === i)) || { columnIndex: i, columnName: h, columnType: h === RECON ? 'BOOLEAN' : MONEY_COLS.has(h) ? 'DOUBLE' : 'TEXT' })
    requests.push({ updateTable: { table: { tableId: existing.tableId, range, columnProperties: props }, fields: 'range,columnProperties' } })
  } else {
    requests.push({
      addTable: {
        table: {
          range,
          rowsProperties: {
            headerColorStyle: colorStyle(160, 132, 104),
            firstBandColorStyle: colorStyle(255, 255, 255),
            secondBandColorStyle: colorStyle(245, 241, 235),
          },
          columnProperties: headers.map((h, i) => ({ columnIndex: i, columnName: h, columnType: h === RECON ? 'BOOLEAN' : MONEY_COLS.has(h) ? 'DOUBLE' : 'TEXT' })),
        },
      },
    })
    requests.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat.textFormat' } })
    withWidths = true
  }
  headers.forEach((h, i) => {
    if (MONEY_COLS.has(h)) requests.push({ repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rows, startColumnIndex: i, endColumnIndex: i + 1 }, cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } }, fields: 'userEnteredFormat.numberFormat' } })
  })
  const reconIdx = headers.indexOf(RECON)
  if (withWidths) requests.push(...widthRequests(sheetId, headers))
  await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })
}

// Writes one yearly tab by column NAME, so the treasurer can reorder columns and add her own (like "Last Reconciled Here").
// Her extra columns travel with their rows: a row is recognised by its own values, so a checked box stays on its row even
// when new rows arrive above it. Columns she deleted are not put back.
async function syncTab(token: string, tabs: Meta[], t: { name: string; headers: string[]; rows: Record<string, unknown>[] }) {
  const title = tabName(t.name)
  await ownTab(token, title, tabs)
  const existing: unknown[][] = ((await sheets(token, `/values/${q(title)}?valueRenderOption=UNFORMATTED_VALUE`)).values) || []
  let cols = (existing[0] || []).map(String)
  while (cols.length && !cols[cols.length - 1]) cols.pop()
  const fresh = cols.length === 0
  if (fresh) cols = [...t.headers, RECON]
  const ours = new Set(t.headers)
  const keyCols = t.headers.filter((c) => cols.includes(c))
  const norm = (col: string, v: unknown) => {
    if (v == null || v === '') return ''
    if (typeof v === 'number') return col === 'Date' ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : String(Math.round(v * 100) / 100)
    const s = String(v).trim()
    return /^-?\d+(\.\d+)?$/.test(s) ? String(Math.round(Number(s) * 100) / 100) : s
  }
  const keyOfRow = (row: unknown[]) => keyCols.map((c) => norm(c, row[cols.indexOf(c)])).join('\u0001')
  const keyOfRec = (r: Record<string, unknown>) => keyCols.map((c) => norm(c, r[c])).join('\u0001')
  const carry = new Map<string, unknown[]>()
  const seenOld: Record<string, number> = {}
  if (!fresh) for (const row of existing.slice(1)) {
    const k = keyOfRow(row), n = (seenOld[k] = (seenOld[k] || 0) + 1)
    carry.set(k + '#' + n, row)
  }
  const seenNew: Record<string, number> = {}
  const out = t.rows.map((r) => {
    const k = keyOfRec(r), n = (seenNew[k] = (seenNew[k] || 0) + 1)
    const prev = carry.get(k + '#' + n)
    return cols.map((c, i) => (ours.has(c) ? (r[c] == null ? '' : r[c]) : (prev?.[i] ?? '')))
  })
  if (fresh) await sheets(token, `/values/${q(title)}!A1?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [cols] }) })
  await sheets(token, `/values/${q(title)}!A2:ZZ:clear`, { method: 'POST', body: '{}' })
  for (let i = 0; i < out.length; i += 5000) {
    await sheets(token, `/values/${q(title)}!A${i + 2}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: out.slice(i, i + 5000) }) })
  }
  await styleTable(token, title)
}

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
  for (const t of await buildYearlyTabs(year)) await syncTab(token, tabs, t)
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

    // ---- one-time: take "Backup - " off the tab names (keeps each tab where it is)
    if (body.action === 'rename') {
      const renamed: string[] = []
      for (const t of tabs.filter((x) => x.title.startsWith(LEGACY_PREFIX))) {
        const plain = t.title.slice(LEGACY_PREFIX.length)
        if (!isOurTab(plain) || tabs.some((x) => x.title === plain)) continue
        await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: t.sheetId, title: plain }, fields: 'title' } }] }) })
        renamed.push(plain)
      }
      return json({ renamed })
    }
    // ---- add the "Last Reconciled Here" checkbox column to any tab that does not have one yet
    if (body.action === 'reconcile') {
      const added: string[] = []
      for (const t of tabs.filter((x) => isOurTab(x.title))) {
        const head = await tabHeader(token, t.title)
        if (!head.length || head.includes(RECON)) continue
        await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ appendDimension: { sheetId: t.sheetId, dimension: 'COLUMNS', length: 1 } }] }) })
        await sheets(token, `/values/${q(t.title)}!${colLetter(head.length + 1)}1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [[RECON]] }) })
        await styleTable(token, t.title)
        added.push(t.title)
      }
      return json({ added })
    }
    // ---- repair: put back a header that the checkbox step overwrote, and move the checkbox column after it
    if (body.action === 'repair') {
      const year = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 4))
      const expected: Record<string, string[]> = { [PAYPAL_TAB]: PP_HEADER, [OTHER_TAB]: HEADER }
      for (const t of await buildYearlyTabs(year)) expected[tabName(t.name)] = t.headers
      const fixed: string[] = []
      for (const t of tabs.filter((x) => isOurTab(x.title))) {
        const head = await tabHeader(token, t.title)
        const want = expected[t.title] || []
        const missing = want.filter((h) => !head.includes(h))
        if (missing.length !== 1 || !head.includes(RECON)) continue
        const next = head.map((h) => (h === RECON ? missing[0] : h))
        next.push(RECON)
        await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: t.sheetId, gridProperties: { columnCount: Math.max(next.length, 1) } }, fields: 'gridProperties.columnCount' } }] }) })
        await sheets(token, `/values/${q(t.title)}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [next] }) })
        await styleTable(token, t.title, undefined, true, true)
        fixed.push(t.title + ': ' + missing[0])
      }
      return json({ fixed })
    }
    // ---- remove columns that have no header and nothing in them (never a column with any data)
    if (body.action === 'cleancols') {
      const cleaned: string[] = []
      for (const t of tabs.filter((x) => isOurTab(x.title))) {
        const all: string[][] = (await sheets(token, `/values/${q(t.title)}`)).values || []
        const head = all[0] || []
        const blank: number[] = []
        for (let i = 0; i < head.length; i++) {
          if ((!String(head[i] || '').trim() || /^Column \d+$/.test(String(head[i]))) && all.slice(1).every((r) => String(r[i] ?? '').trim() === '')) blank.push(i)
        }
        if (!blank.length) continue
        const requests = blank.sort((x, y) => y - x).map((i) => ({ deleteDimension: { range: { sheetId: t.sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }))
        await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })
        await styleTable(token, t.title)
        cleaned.push(t.title + ' (' + blank.length + ')')
      }
      return json({ cleaned })
    }
    // ---- one-time: set comfortable column widths on every tab
    if (body.action === 'widths') {
      const done: string[] = []
      for (const t of tabs.filter((x) => isOurTab(x.title))) { await styleTable(token, t.title, undefined, true); done.push(t.title) }
      return json({ widths: done })
    }
    // ---- give every backup tab the table look (visual only)
    if (body.action === 'style') {
      const done: string[] = []
      for (const t of tabs.filter((x) => isOurTab(x.title))) {
        const head = await sheets(token, `/values/${q(t.title)}!1:1`)
        const headers = ((head.values && head.values[0]) || []).map(String).filter(Boolean)
        if (headers.length) { await styleTable(token, t.title, headers); done.push(t.title) }
      }
      return json({ styled: done })
    }
    // ---- yearly Financial Overview tabs, rebuilt from the database (called by the database whenever the records change)
    if (body.action === 'yearly') return json(await runYearlySync(token, tabs))

    // ---- add-only ledger tabs
    await ownTab(token, PAYPAL_TAB, tabs)
    await ownTab(token, OTHER_TAB, tabs)
    const ppReset = await ensureHeader(token, PAYPAL_TAB, PP_HEADER, body.rebuild === "paypal")
    const otherReset = await ensureHeader(token, OTHER_TAB, HEADER)
    const [ledger, done]: [Record<string, unknown>[], { payment_key: string }[]] = await Promise.all([
      rest('rpc/treasurer_payments_all', { method: 'POST', body: '{}' }),
      rest('payment_backup_log?select=payment_key&limit=100000'),
    ])
    // The PayPal tab was just rebuilt in the new layout: forget its payments so they are written again.
    // A tab that was just rebuilt (new layout) has forgotten its payments: clear their log entries so they are written again.
    const resetCats: boolean[] = [...(ppReset ? [true] : []), ...(otherReset ? [false] : [])]
    const inReset = (p: Record<string, unknown>) => resetCats.includes(isPayPal(p))
    if (resetCats.length) {
      const keys = ledger.filter(inReset).map((p) => String(p.payment_key))
      for (let i = 0; i < keys.length; i += 100) {
        await rest(`payment_backup_log?payment_key=in.(${keys.slice(i, i + 100).map((k) => '"' + k + '"').join(',')})`, { method: 'DELETE' })
      }
    }
    const have = new Set(done.map((d) => d.payment_key).filter((k) => !ledger.some((p) => p.payment_key === k && inReset(p))))
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
        const ppCols = await tabHeader(token, PAYPAL_TAB)
        await sheets(token, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ insertDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + newestFirst.length }, inheritFromBefore: false } }] }) })
        await sheets(token, `/values/${q(title)}!A2?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: newestFirst.map((p) => inOrder(ppCols, ppObj(p))) }) })
        for (let i = 0; i < newestFirst.length; i += 200) {
          await rest('payment_backup_log', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(newestFirst.slice(i, i + 200).map((p) => ({ payment_key: p.payment_key }))) })
        }
        newestFirst.forEach((p) => written.add(String(p.payment_key)))
        counts[key] += newestFirst.length
        continue
      }
      for (let i = 0; i < mine.length; i += 200) {
        const chunk = mine.slice(i, i + 200)
        const otherCols = await tabHeader(token, OTHER_TAB)
        const values = chunk.map((p) => inOrder(otherCols, otherObj(p, stamp)))
        await sheets(token, `/values/${q(title)}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) })
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
    if (counts.paypal) await styleTable(token, PAYPAL_TAB, PP_HEADER)
    if (counts.other) await styleTable(token, OTHER_TAB, HEADER)
    return json({ added: counts.paypal + counts.other, ...counts })
  } catch (e) {
    return json({ error: (e as Error).message || 'Backup failed' }, 500)
  }
})
