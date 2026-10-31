// Monthly board update email: volunteer hours, venue inquiries and tours, private docent tour requests, volunteer inquiries,
// new sponsors, donations, and the status of the quarterly reports. Built from live Portal data.
//
// Runs on the 1st of each month (pg_cron, see add_board_monthly_report.sql) and covers the month that just ended.
// TEST MODE until approved: while private_config 'board_report_mode' is not 'live', the email goes only to media@ with a
// TEST banner. In live mode it goes to every active board member (media@ is always copied).
//
// POST body (all optional): { month: 'YYYY-MM' }  which month to report (default: last month)
//                           { current: true }     report the current month so far (for a preview mid-month)
//                           { to: 'a@b.com' }     send the test to this address instead of media@

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LA = 'America/Los_Angeles'
const GOLD = '#886c44'
const TEST_TO = 'media@thenorthstarhouse.org'
const AREAS = ['Construction', 'Grounds', 'Interiors', 'Docents', 'Fundraising', 'Events', 'Marketing', 'Venue']
const RENTAL_INQUIRY_FORMS: Record<string, string> = {
  '1eea2137-f94d-414b-a977-4ed622214580': 'Wedding',
  'a87b86b0-94cd-4d28-b57e-00b79b5f1fee': 'Event',
  '5b886667-5230-4866-9874-7bc0dcdb3320': 'Event',
  'cd8f1e9f-06c5-4369-8b66-3498aff31465': 'Event',
  '952bc156-e89d-4790-814d-d2c2e9738a8b': 'Memorial',
  'e8cc69a1-1693-4fb4-8518-b8bb486dd055': 'Nonprofit',
}
const DOCENT_TOUR_FORM = '0635cd26-b0c7-4076-b9b1-bd25d1949467'
const VOLUNTEER_INTEREST_FORM = '11342c74-d0f0-4cb3-9b9e-57f30b4ae3a7'
// Due dates, same schedule as the Portal's Quarterly Schedule.
const QUARTERS = [
  { q: 'Q1', end: [3, 31], due: 'March 31', champion: 'April 2', board: 'April 16' },
  { q: 'Q2', end: [6, 30], due: 'June 30', champion: 'July 2', board: 'July 16' },
  { q: 'Q3', end: [9, 30], due: 'September 30', champion: 'October 1', board: 'October 15' },
  { q: 'Q4', end: [12, 31], due: 'December 10', champion: 'December 10', board: 'December 17' },
]

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
async function rest(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })
  if (!r.ok) throw new Error(`${path.split('?')[0]} -> HTTP ${r.status}`)
  return r.json()
}
const laDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: LA })
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hrs = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })
const num = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

// A date string moved by n days (the database stores UTC, our months are Pacific time, so queries are widened and filtered after).
function shift(day: string, n: number) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { y, m, start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}`, label: new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}
function pickMonth(body: { month?: string; current?: boolean }) {
  if (body.month && /^\d{4}-\d{2}$/.test(body.month)) return body.month
  const today = laDay(new Date().toISOString()) // YYYY-MM-DD in Pacific time
  let [y, m] = today.split('-').map(Number)
  if (!body.current) { m -= 1; if (m === 0) { m = 12; y -= 1 } }
  return `${y}-${String(m).padStart(2, '0')}`
}

// ---- data ----------------------------------------------------------------------------------------------------------
async function volunteerHours(b: ReturnType<typeof monthBounds>) {
  const year = b.y
  let logs: { name: string; action: string; timestamp: string }[] = []
  for (let off = 0; ; off += 1000) {
    const page = await rest(`kiosk_logs?type=eq.volunteer&timestamp=gte.${year}-01-01T00:00:00.000Z&timestamp=lt.${year + 1}-01-01T00:00:00.000Z&order=name.asc,timestamp.asc&select=name,action,timestamp&limit=1000&offset=${off}`)
    logs = logs.concat(page)
    if (page.length < 1000) break
  }
  const by: Record<string, typeof logs> = {}
  for (const l of logs) { const n = (l.name || '').trim(); if (n) (by[n] = by[n] || []).push(l) }
  const per: Record<string, { m: number; y: number }> = {}
  let month = 0, ytd = 0
  for (const n of Object.keys(by)) {
    const L = by[n]
    for (let i = 0; i < L.length; i++) {
      if (L[i].action !== 'check-in') continue
      const out = L.slice(i + 1).find((x) => x.action === 'check-out')
      if (!out) continue
      const h = (new Date(out.timestamp).getTime() - new Date(L[i].timestamp).getTime()) / 3600000
      if (h <= 0 || h > 24) continue
      const d = laDay(L[i].timestamp)
      if (d > b.end) continue // only count up to the end of the reported month
      const k = n.toLowerCase().replace(/\s+/g, ' ')
      per[k] = per[k] || { m: 0, y: 0 }
      ytd += h; per[k].y += h
      if (d >= b.start) { month += h; per[k].m += h }
    }
  }
  const board = await rest(`2026%20Volunteers?select=${encodeURIComponent('First Name,Last Name,Team,Email,Status')}&Team=ilike.*board*`)
  let bMonth = 0, bYear = 0, bPeople = 0
  for (const p of board) {
    const k = `${p['First Name'] || ''} ${p['Last Name'] || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
    if (per[k]) { bMonth += per[k].m; bYear += per[k].y; bPeople++ }
  }
  return { month, ytd, bMonth, bYear, bPeople, boardRows: board as { Email?: string; Status?: string }[] }
}

async function formCounts(b: ReturnType<typeof monthBounds>) {
  const ids = [...Object.keys(RENTAL_INQUIRY_FORMS), DOCENT_TOUR_FORM, VOLUNTEER_INTEREST_FORM]
  const rows: { form_id: string; created_at: string; answers?: Record<string, unknown> }[] = await rest(`nsh_form_responses?select=form_id,created_at,answers&form_id=in.(${ids.join(',')})&archived_at=is.null&created_at=gte.${shift(b.start, -1)}T00:00:00.000Z&created_at=lt.${shift(b.end, 2)}T00:00:00.000Z&limit=2000`)
  const inMonth = rows.filter((r) => { const d = laDay(r.created_at); return d >= b.start && d <= b.end })
  const kinds: Record<string, number> = { Wedding: 0, Event: 0, Memorial: 0, Nonprofit: 0 }
  let inquiries = 0, docent = 0, volunteers = 0
  const volAreas: Record<string, number> = {} // which areas the new volunteers said they are interested in
  for (const r of inMonth) {
    if (RENTAL_INQUIRY_FORMS[r.form_id]) { inquiries++; kinds[RENTAL_INQUIRY_FORMS[r.form_id]]++ }
    else if (r.form_id === DOCENT_TOUR_FORM) docent++
    else if (r.form_id === VOLUNTEER_INTEREST_FORM) {
      volunteers++
      const raw = r.answers?.v_interest
      const list = Array.isArray(raw) ? raw : raw ? [raw] : []
      for (const a of list) { const k = String(a).trim(); if (k) volAreas[k] = (volAreas[k] || 0) + 1 }
    }
  }
  return { inquiries, kinds, docent, volunteers, volAreas }
}

async function tourCounts(b: ReturnType<typeof monthBounds>) {
  const rows: { status: string; date: string }[] = await rest(`estate_tours?select=status,date&date=gte.${b.start}&date=lte.${b.end}&status=in.(booked,cancelled,no_show)&limit=2000`)
  const c = { booked: 0, cancelled: 0, noShow: 0 }
  for (const r of rows) { if (r.status === 'booked') c.booked++; else if (r.status === 'cancelled') c.cancelled++; else if (r.status === 'no_show') c.noShow++ }
  return c
}

async function donationTotals(b: ReturnType<typeof monthBounds>) {
  const rows: { amount: number | string; date: string }[] = await rest(`donations?select=amount,date&date=gte.${b.start}&date=lte.${b.end}&limit=5000`)
  return { count: rows.length, total: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) }
}

// What got done in the month, and what is coming up, from the Portal's "North Star House Updates".
type Upd = { kind: string; title: string; details?: string | null; happened_on?: string | null; area?: string | null }
async function houseUpdates(b: ReturnType<typeof monthBounds>) {
  let rows: Upd[] = []
  try { rows = await rest('nsh_updates?select=kind,title,details,happened_on,area&include_in_email=eq.true&order=happened_on.asc.nullslast&limit=500') } catch { rows = [] }
  const today = laDay(new Date().toISOString())
  const done = rows.filter((u) => u.kind === 'done' && u.happened_on && u.happened_on >= b.start && u.happened_on <= b.end)
  const upcoming = rows.filter((u) => u.kind === 'upcoming' && (!u.happened_on || u.happened_on >= today)).slice(0, 15)
  return { done, upcoming }
}

// A sponsor is "new" when their first contribution on record falls in the reported month.
async function newSponsors(b: ReturnType<typeof monthBounds>) {
  const [sponsors, gifts]: [{ id: string; 'Business Name'?: string }[], { sponsor_id: string; value: number | string; date: string; description?: string; contribution_type?: string }[]] =
    await Promise.all([rest('Sponsors?select=id,Business%20Name'), rest('Sponsor%20In-Kind?select=sponsor_id,value,date,description,contribution_type&limit=5000')])
  const out: { name: string; total: number; what: string[] }[] = []
  for (const s of sponsors) {
    const mine = gifts.filter((g) => g.sponsor_id === s.id && g.date).sort((x, y) => String(x.date).localeCompare(String(y.date)))
    if (!mine.length) continue
    if (String(mine[0].date) < b.start || String(mine[0].date) > b.end) continue
    const inMonth = mine.filter((g) => String(g.date) >= b.start && String(g.date) <= b.end)
    out.push({ name: s['Business Name'] || 'Sponsor', total: inMonth.reduce((t, g) => t + (Number(g.value) || 0), 0), what: inMonth.map((g) => g.contribution_type || g.description || '').filter(Boolean) })
  }
  return out.sort((a, c) => c.total - a.total)
}

// The most recent quarter that has ended, and which areas haven't turned in its update.
async function quarterlyStatus() {
  const today = laDay(new Date().toISOString())
  const y = Number(today.slice(0, 4))
  const ended = [...QUARTERS.map((q) => ({ ...q, year: y - 1 })), ...QUARTERS.map((q) => ({ ...q, year: y }))]
    .filter((q) => `${q.year}-${String(q.end[0]).padStart(2, '0')}-${String(q.end[1]).padStart(2, '0')}` < today)
  const last = ended[ended.length - 1]
  const next = QUARTERS[(QUARTERS.findIndex((q) => q.q === last.q) + 1) % 4]
  const subs: { area: string }[] = await rest(`Op%20Quarterly%20Updates?select=area&quarter=eq.${last.q}&year=eq.${last.year}`)
  const have = new Set(subs.map((s) => s.area))
  return { quarter: last.q, year: last.year, missing: AREAS.filter((a) => !have.has(a)), done: AREAS.filter((a) => have.has(a)), next }
}

// ---- email ---------------------------------------------------------------------------------------------------------
const P = 'font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#555;'
const H3 = `margin:30px 0 10px;font-family:Georgia,serif;font-size:20px;font-weight:400;color:#2a2420;border-bottom:1px solid #e5ddcf;padding-bottom:6px;`
const tile = (big: string, label: string) =>
  `<td width="50%" style="padding:6px;"><div style="background:#f6f1e7;border-radius:6px;padding:14px 12px;text-align:center;"><div style="font-family:Georgia,serif;font-size:28px;color:${GOLD};">${esc(big)}</div><div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#777;margin-top:2px;">${esc(label)}</div></div></td>`
const tiles = (items: [string, string][]) => {
  let rows = ''
  for (let i = 0; i < items.length; i += 2) rows += `<tr>${tile(items[i][0], items[i][1])}${items[i + 1] ? tile(items[i + 1][0], items[i + 1][1]) : '<td width="50%"></td>'}</tr>`
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px -6px;">${rows}</table>`
}

function build(label: string, d: {
  h: Awaited<ReturnType<typeof volunteerHours>>; f: Awaited<ReturnType<typeof formCounts>>; t: Awaited<ReturnType<typeof tourCounts>>
  don: Awaited<ReturnType<typeof donationTotals>>; sp: Awaited<ReturnType<typeof newSponsors>>; qs: Awaited<ReturnType<typeof quarterlyStatus>>; up: Awaited<ReturnType<typeof houseUpdates>>
}, test: boolean) {
  const { h, f, t, don, sp, qs, up } = d
  let html = ''
  let text = `NORTH STAR HOUSE — BOARD UPDATE, ${label.toUpperCase()}\n\n`
  const section = (title: string, bodyHtml: string, bodyText: string) => { html += `<h3 style="${H3}">${esc(title)}</h3>${bodyHtml}`; text += `${title.toUpperCase()}\n${bodyText}\n\n` }

  const when = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '')
  const item = (u: Upd) => `<p style="${P}margin:0 0 10px;"><strong style="color:#2a2420;">${esc(u.title)}</strong>${u.area && u.area !== 'General' ? ` <span style="font-size:12px;color:${GOLD};">· ${esc(u.area)}</span>` : ''}${u.happened_on ? `<br><span style="font-size:13px;color:#888;">${esc(when(u.happened_on))}</span>` : ''}${u.details ? `<br><span style="font-size:14px;">${esc(u.details)}</span>` : ''}</p>`
  const itemText = (u: Upd) => `- ${u.title}${u.happened_on ? ' (' + when(u.happened_on) + ')' : ''}${u.details ? ': ' + u.details : ''}`
  if (up.done.length > 0) section('What Got Done', up.done.map(item).join(''), up.done.map(itemText).join('\n'))

  section('Volunteer Hours', tiles([[hrs(h.month), `volunteer hours in ${label.split(' ')[0]}`], [hrs(h.ytd), 'volunteer hours this year'], [hrs(h.bMonth), `board volunteer hours in ${label.split(' ')[0]}`], [hrs(h.bYear), 'board volunteer hours this year']]),
    `${hrs(h.month)} hours this past month; ${hrs(h.ytd)} this year. Board members: ${hrs(h.bMonth)} this past month; ${hrs(h.bYear)} this year.`)

  const kindBits = Object.entries(f.kinds).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')
  section('Venue', tiles([[num(f.inquiries), plural(f.inquiries, 'venue inquiry', 'venue inquiries')], [num(t.booked), plural(t.booked, 'venue tour', 'venue tours')], [num(f.docent), 'private docent tour ' + plural(f.docent, 'request', 'requests')], [num(t.cancelled + t.noShow), 'cancelled or no-show']]) +
    (kindBits ? `<p style="${P}font-size:13px;color:#888;margin:6px 0 0;">Inquiries: ${esc(kindBits)}.</p>` : ''),
    `${f.inquiries} venue inquiries${kindBits ? ' (' + kindBits + ')' : ''}; ${t.booked} venue tours; ${f.docent} private docent tour requests; ${t.cancelled} cancelled and ${t.noShow} no-shows.`)

  const giving = `${num(don.count)} ${plural(don.count, 'donation', 'donations')} totaling ${money(don.total)}.`
  section('Donations', `<p style="${P}"><strong style="color:#2a2420;">${esc(giving)}</strong></p>`, giving)

  if (f.volunteers > 0) {
    const areas = Object.entries(f.volAreas).sort((a, c) => c[1] - a[1]).map(([a, n]) => `${a}${n > 1 ? ' (' + n + ')' : ''}`)
    const v = `${f.volunteers} new volunteer ${plural(f.volunteers, 'inquiry', 'inquiries')} this month.`
    const interest = areas.length ? `Areas they are interested in: ${areas.join(', ')}.` : ''
    section('Volunteer Inquiries', `<p style="${P}">${esc(v)}</p>` + (interest ? `<p style="${P}">${esc(interest)}</p>` : ''), v + (interest ? ' ' + interest : ''))
  }
  if (sp.length > 0) {
    const lines = sp.map((s) => `${s.name}: ${money(s.total)}${s.what.length ? ' (' + s.what.join(', ') + ')' : ''}`)
    section('New Sponsors', `<p style="${P}">Welcome to ${sp.length} new ${plural(sp.length, 'sponsor', 'sponsors')}:</p>` + sp.map((s, i) => `<p style="${P}margin:0 0 6px;"><strong style="color:#2a2420;">${esc(s.name)}</strong> &mdash; ${esc(money(s.total))}${s.what.length ? `<br><span style="font-size:13px;color:#888;">${esc(s.what.join(', '))}</span>` : ''}</p>`).join(''), lines.join('\n'))
  }

  if (up.upcoming.length > 0) section('Coming Up', up.upcoming.map(item).join(''), up.upcoming.map(itemText).join('\n'))

  const qTitle = `Quarterly Reports (${qs.quarter} ${qs.year})`
  if (qs.missing.length === 0) {
    section(qTitle, `<p style="${P}">Every area has turned in its ${esc(qs.quarter)} update. Thank you! Next up: ${esc(qs.next.q)} updates are due <strong>${esc(qs.next.due)}</strong>, Co-Champions review ${esc(qs.next.champion)}, Board meeting ${esc(qs.next.board)}.</p>`,
      `Every area has turned in its ${qs.quarter} update. Next: ${qs.next.q} updates due ${qs.next.due}.`)
  } else {
    section(qTitle, `<p style="${P}">Still waiting on the ${esc(qs.quarter)} update from: <strong style="color:#2a2420;">${esc(qs.missing.join(', '))}</strong>.</p><p style="${P}">Next up: ${esc(qs.next.q)} updates are due <strong>${esc(qs.next.due)}</strong>, Co-Champions review ${esc(qs.next.champion)}, Board meeting ${esc(qs.next.board)}.</p>`,
      `Still waiting on the ${qs.quarter} update from: ${qs.missing.join(', ')}. Next: ${qs.next.q} updates due ${qs.next.due}, Co-Champions ${qs.next.champion}, Board ${qs.next.board}.`)
  }
  text += 'Thank you for everything you do.\nNorth Star House'

  const banner = test ? `<div style="background:#fff3cd;color:#664d03;padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:13px;text-align:center;">TEST: this is a preview of the monthly board update. It has not been sent to the board.</div>` : ''
  const full = `${banner}<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:600px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${GOLD};"></div><div style="padding:38px 36px 32px;">
<div style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:${GOLD};font-weight:bold;margin-bottom:14px;">NORTH STAR HOUSE</div>
<h1 style="margin:0 0 6px;text-align:center;font-size:30px;font-weight:400;color:#2a2420;">Board Update</h1>
<p style="margin:0 0 20px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#888;">${esc(label)}</p>
<p style="${P}">Here's a look at the work happening at North Star House last month.</p>
${html}
<p style="margin:30px 0 0;text-align:center;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Thank you for everything you do for North Star House.</i></p>
</div></div></div>`
  return { html: full, text }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const ym = pickMonth(body)
    const b = monthBounds(ym)
    const [h, f, t, don, sp, qs, up] = await Promise.all([volunteerHours(b), formCounts(b), tourCounts(b), donationTotals(b), newSponsors(b), quarterlyStatus(), houseUpdates(b)])

    const mode = (await rest('private_config?select=value&key=eq.board_report_mode').catch(() => []))[0]?.value || 'test'
    const live = mode === 'live' && !body.to
    const { html, text } = build(b.label, { h, f, t, don, sp, qs, up }, !live)

    const boardEmails = Array.from(new Set(h.boardRows.filter((p) => p.Email && (p.Status || 'Active') === 'Active').map((p) => String(p.Email).trim().toLowerCase()))).filter((e) => /.+@.+\..+/.test(e))
    const to = live && boardEmails.length ? boardEmails : [body.to || TEST_TO]
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ to, subject: `${live ? '' : 'TEST: '}Board Update: ${b.label}`, body: text, html, sender: 'Board Update', fromEmail: 'venue@northstarhouse.org' }),
    })
    if (!res.ok) throw new Error(`send-email HTTP ${res.status}: ${await res.text()}`)
    return json({ ok: true, month: b.label, mode: live ? 'live' : 'test', sent_to: to.length, summary: { hours: h.month, ytd: h.ytd, board_ytd: h.bYear, inquiries: f.inquiries, tours: t.booked, docent: f.docent, volunteer_inquiries: f.volunteers, new_sponsors: sp.length, donations: don.count, donation_total: don.total, q_missing: qs.missing } })
  } catch (e) {
    console.error('send-board-monthly-report', e instanceof Error ? e.message : e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
