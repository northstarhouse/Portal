// Emails each estate tour guide their booked tours for the week, every
// Monday at 5am Pacific.
//
// pg_cron runs in UTC, so the job fires at both 12:00 and 13:00 UTC on
// Mondays (5am PDT / 5am PST) and this function only sends on the run where
// it's actually 5am in Los Angeles -- one email per week, all year.
//
// Guides and their emails live in the tour_guides table. A tour's guide is
// its guide_name, or for 'default' slots the weekday rule shared with the
// booking confirmation and send-tour-reminders (Jen: Mon/Tue/Thu). Every
// active guide gets an email, even with no tours, so a quiet week is
// confirmed rather than ambiguous. Booked tours with no guide are sent to
// the office (media@) so nothing falls through.
//
// POST body (all optional):
//   { week_start: 'YYYY-MM-DD', test_to: 'someone@...' }
// test_to sends every email to that address only, marked [TEST], and skips
// the 5am check. week_start picks the Monday (defaults to this week's).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const WEBSITE_URL = 'https://www.northstarhouse.org'
const PORTAL_URL = 'https://northstarhouse.github.io/Portal/'
const OFFICE_EMAIL = 'media@thenorthstarhouse.org'
const GOLD = '#886c44'
const TIME_ZONE = 'America/Los_Angeles'

const FOOTER_LINKS = [
  { label: 'Portal', url: PORTAL_URL },
  { label: 'Website', url: `${WEBSITE_URL}/` },
  { label: 'Directions', url: `${WEBSITE_URL}/directions-parking` },
]

// Email headlines: capitalise each word, keeping small words (a, of, the, for...) lowercase unless first or last.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'up', 'as', 'vs'])
function titleCase(t: string): string {
  if (/[<&]/.test(t)) return t
  const w = String(t).split(' ')
  return w.map((x, i) => (!x || (i > 0 && i < w.length - 1 && SMALL_WORDS.has(x.toLowerCase())) ? x : x.charAt(0).toUpperCase() + x.slice(1))).join(' ')
}

// Same branded shell as send-tour-reminders / the Portal's own emails.
function buildBrandedEmailHtml(opts: { headline: string; subtext: string; buttonText?: string; buttonUrl?: string; note?: string }) {
  const { headline, subtext, buttonText, buttonUrl, note } = opts
  const footerCells = FOOTER_LINKS
    .map((l, i) => {
      const border = i < FOOTER_LINKS.length - 1 ? 'border-right:1px solid #e5ddcf;' : ''
      return `<td style="width:${(100 / FOOTER_LINKS.length).toFixed(2)}%;text-align:center;padding:14px 8px;${border}"><a href="${l.url}" style="color:${GOLD};text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:13px;">${l.label}</a></td>`
    })
    .join('')
  return (
    `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fdfbf7;border-radius:2px;overflow:hidden;">` +
    `<div style="height:14px;background:${GOLD};"></div>` +
    `<div style="padding:48px 40px 32px;text-align:center;">` +
    `<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${titleCase(headline)}</h1>` +
    `<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>` +
    `<div style="margin:0 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.5;text-align:left;">${subtext}</div>` +
    (buttonUrl ? `<a href="${buttonUrl}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:16px;padding:16px 32px;border-radius:6px;margin-bottom:8px;">${buttonText}</a>` : '') +
    (note ? `<p style="margin:20px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>${note}</i></p>` : '') +
    `</div>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse;border-top:1px solid #e5ddcf;">` +
    `<tr>${footerCells}</tr>` +
    `</table>` +
    `</div>` +
    `</div>`
  )
}

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

// Dates/times are stored as plain Pacific wall-clock values; format them
// as-is (UTC here is just so nothing shifts them).
function fmtDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
function fmtShort(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
function fmtTime(time: string) {
  return new Date(`2000-01-01T${time}Z`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}
function fmtPhone(p: string | null) {
  const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '')
}
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Pacific "now" as { date, hour, weekday(0=Sun) }.
function pacificNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, weekday }
}

// Same rule as send-tour-reminders and the website's booking confirmation.
const DEFAULT_GUIDES_BY_WEEKDAY: Record<number, string> = { 1: 'Jen', 2: 'Jen', 4: 'Jen' } // 0 = Sunday
function tourGuideFor(date: string, guideName?: string | null) {
  const assigned = String(guideName || '').trim()
  if (assigned && assigned.toLowerCase() !== 'default') return assigned
  return DEFAULT_GUIDES_BY_WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()] || ''
}

// Mirrors tourCategoryLabel() in add-tour-to-calendar / the Portal.
const WEDDING_FORM_ID = '1eea2137-f94d-414b-a977-4ed622214580'
const EVENT_TYPE_FIELD_ID = '0uj9rtfk'
function tourType(t: Tour) {
  if (t.inquiry_form_id === WEDDING_FORM_ID) return 'Wedding'
  const eventType = t.inquiry_answers?.[EVENT_TYPE_FIELD_ID]
  if (eventType === 'Non-Profit Event') return 'Non-Profit'
  if (eventType === 'Memorial') return 'Memorial'
  if (eventType === 'Private Event' || eventType === 'Public Event') return 'Event'
  return t.category || 'Estate tour'
}

type Tour = {
  id: string; date: string; start_time: string; duration_min: number | null; guide_name: string | null
  visitor_name: string | null; visitor_email: string | null; visitor_phone: string | null
  inquiry_form_id: string | null; inquiry_answers: Record<string, unknown> | null; staff_notes: string | null; category: string | null
}

async function sb(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`)
  return r.json()
}

async function sendMail(to: string, subject: string, text: string, html: string, bcc?: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Estate Tours · North Star House <info@northstarhouse.org>', to: [to], ...(bcc ? { bcc: [bcc] } : {}), subject, text, html }),
  })
  return res.ok
}

// One guide's (or the office's) email for the week.
function buildEmail(greetName: string, intro: string, weekLabel: string, tours: Tour[]) {
  const byDay = new Map<string, Tour[]>()
  for (const t of tours) byDay.set(t.date, [...(byDay.get(t.date) || []), t])

  const htmlDays = [...byDay.entries()].map(([date, list]) =>
    `<div style="margin:22px 0 0;">` +
    `<div style="font-family:Georgia,serif;font-size:17px;color:#2a2420;border-bottom:1px solid #e5ddcf;padding-bottom:6px;margin-bottom:4px;">${esc(fmtDay(date))}</div>` +
    list.map((t) =>
      `<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px;"><tr>` +
      `<td style="width:92px;vertical-align:top;font-weight:bold;color:${GOLD};white-space:nowrap;padding-right:10px;">${esc(fmtTime(t.start_time))}</td>` +
      `<td style="vertical-align:top;">` +
      `<div style="font-weight:bold;color:#2a2420;">${esc(t.visitor_name || 'Visitor')}</div>` +
      `<div style="font-size:13px;color:#777;">${esc(tourType(t))} · ${esc(t.duration_min || 45)} min</div>` +
      (t.visitor_email ? `<div style="font-size:13px;"><a href="mailto:${esc(t.visitor_email)}" style="color:${GOLD};">${esc(t.visitor_email)}</a></div>` : '') +
      (t.visitor_phone ? `<div style="font-size:13px;"><a href="tel:${esc(String(t.visitor_phone).replace(/[^\d+]/g, ''))}" style="color:${GOLD};">${esc(fmtPhone(t.visitor_phone))}</a></div>` : '') +
      (t.staff_notes ? `<div style="font-size:13px;color:#555;margin-top:4px;"><i>Notes: ${esc(t.staff_notes)}</i></div>` : '') +
      `</td></tr></table>`
    ).join('') +
    `</div>`
  ).join('')

  const textDays = [...byDay.entries()].map(([date, list]) =>
    `${fmtDay(date)}\n` + list.map((t) =>
      `  ${fmtTime(t.start_time)}  ${t.visitor_name || 'Visitor'} (${tourType(t)}, ${t.duration_min || 45} min)` +
      (t.visitor_email ? `\n           ${t.visitor_email}` : '') +
      (t.visitor_phone ? `\n           ${fmtPhone(t.visitor_phone)}` : '') +
      (t.staff_notes ? `\n           Notes: ${t.staff_notes}` : '')
    ).join('\n')
  ).join('\n\n')

  const count = tours.length
  const summary = count === 0 ? 'No tours are booked this week.' : `${count} tour${count === 1 ? '' : 's'} booked this week:`
  const html = buildBrandedEmailHtml({
    headline: 'Your Tours This Week',
    subtext: `Good morning ${esc(greetName)}, ${esc(intro)} <strong>${esc(weekLabel)}</strong>.<br><br>${esc(summary)}` + htmlDays,
    buttonText: 'Open the Portal',
    buttonUrl: PORTAL_URL,
    note: 'Tours booked or moved later in the week will show in the Portal and on the calendar.',
  })
  const text = `Good morning ${greetName}, ${intro} ${weekLabel}.\n\n${summary}\n\n${textDays}${textDays ? '\n\n' : ''}Portal: ${PORTAL_URL}\n\nNorth Star House`
  return { html, text, count }
}

Deno.serve(async (req) => {
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const testTo: string | undefined = body.test_to
    const now = pacificNow()
    if (!testTo && !body.week_start && !(now.weekday === 1 && now.hour === 5)) {
      return Response.json({ ok: true, skipped: `not 5am Monday in Los Angeles (${now.date} ${now.hour}:00)` })
    }

    const weekStart: string = /^\d{4}-\d{2}-\d{2}$/.test(body.week_start || '') ? body.week_start : addDays(now.date, -((now.weekday + 6) % 7))
    const weekEnd = addDays(weekStart, 6)
    const weekLabel = `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`

    const [guides, tours]: [{ name: string; email: string }[], Tour[]] = await Promise.all([
      sb('tour_guides?active=eq.true&select=name,email'),
      sb(`estate_tours?status=eq.booked&date=gte.${weekStart}&date=lte.${weekEnd}&select=id,date,start_time,duration_min,guide_name,visitor_name,visitor_email,visitor_phone,inquiry_form_id,inquiry_answers,staff_notes,category&order=date.asc,start_time.asc`),
    ])

    const byGuide = new Map<string, Tour[]>()
    for (const t of tours) {
      const g = tourGuideFor(t.date, t.guide_name).toLowerCase()
      byGuide.set(g, [...(byGuide.get(g) || []), t])
    }

    const tag = testTo ? '[TEST] ' : ''
    const results: Record<string, unknown>[] = []
    for (const g of guides) {
      const mine = byGuide.get(g.name.toLowerCase()) || []
      byGuide.delete(g.name.toLowerCase())
      const firstName = g.name.split(/\s+/)[0]
      const { html, text, count } = buildEmail(firstName, 'here is your estate tour schedule for the week of', weekLabel, mine)
      const subject = `${tag}Your tours this week (${weekLabel}): ${count === 0 ? 'none booked' : `${count} tour${count === 1 ? '' : 's'}`}`
      const ok = await sendMail(testTo || g.email, subject, text, html, testTo ? undefined : OFFICE_EMAIL)
      results.push({ guide: g.name, to: testTo || g.email, tours: count, sent: ok })
    }

    // Booked tours whose guide isn't in tour_guides (or has no guide at all).
    const leftover = [...byGuide.values()].flat().sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    if (leftover.length) {
      const { html, text, count } = buildEmail('team', 'these booked tours have no guide with an email on file for the week of', weekLabel, leftover)
      const ok = await sendMail(testTo || OFFICE_EMAIL, `${tag}Tours with no guide this week (${weekLabel}): ${count}`, text, html)
      results.push({ guide: '(none)', to: testTo || OFFICE_EMAIL, tours: count, sent: ok })
    }

    return Response.json({ ok: true, week: weekLabel, results })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
