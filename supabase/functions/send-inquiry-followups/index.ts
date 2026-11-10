// 48-hour follow-up for website inquiries. If someone filled out an inquiry form (wedding, event, memorial or nonprofit) and,
// two days later, has neither booked nor requested a tour, they get one branded email: the wedding one adds whether their
// date looks open, pricing basics and common questions; the event, memorial and nonprofit ones are shorter and written for
// that audience. Every one has the same "Book a Tour" button, which goes to the stand-alone tour scheduler page
// (/book-a-tour, tagged with the inquiry type). Run a few times a day by pg_cron (see add_inquiry_followups.sql).
//
// Safe to run any number of times: each inquiry is claimed in inquiry_followups (primary key = response id)
// before the email goes out, and the same email address is never followed up twice.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEDDING_FORM_ID = '1eea2137-f94d-414b-a977-4ed622214580'
// Inquiry forms and which kind of follow-up each gets. (The general Event Inquiry form is the older one; the private and
// public event forms replaced it.)
type Kind = 'wedding' | 'event' | 'memorial' | 'nonprofit'
const FORM_KIND: Record<string, Kind> = {
  [WEDDING_FORM_ID]: 'wedding',
  'a87b86b0-94cd-4d28-b57e-00b79b5f1fee': 'event',
  '5b886667-5230-4866-9874-7bc0dcdb3320': 'event',
  'cd8f1e9f-06c5-4369-8b66-3498aff31465': 'event',
  '952bc156-e89d-4790-814d-d2c2e9738a8b': 'memorial',
  'e8cc69a1-1693-4fb4-8518-b8bb486dd055': 'nonprofit',
}
const TOUR_PAGE = (kind: Kind) => `https://www.northstarhouse.org/book-a-tour?type=${kind}`
// Only inquiries received on/after this moment are followed up, so turning this on never emails the backlog.
const FOLLOWUP_START = '2026-10-27T00:00:00Z'
const MAX_AGE_DAYS = 7 // an inquiry older than this is left to staff
const SITE = 'https://www.northstarhouse.org'
const GOLD = '#886c44'

const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } })
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${await r.text()}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const validEmail = (e: string) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e)

// Calendar events that are just tours/meetings don't hold a wedding date.
const NOT_A_HOLD = /\b(tour|walk[\s-]?through|meeting|volunteer|docent|reflection|goals|due)\b/i

function icalDay(val: string | undefined): string | null {
  if (!val) return null
  const raw = val.replace(/[^0-9TZ]/g, '')
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/)
  if (!m) return null
  const d = raw.endsWith('Z') ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// 'open' | 'held' | 'unknown'
async function dateStatus(day: string, events: Record<string, string>[] | null): Promise<'open' | 'held' | 'unknown'> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'unknown'
  const booked = await rest(`venue_inquiries?select=id&event_date=eq.${day}&prebooking_form_response_id=not.is.null&limit=1`)
  if (booked.length) return 'held'
  if (!events) return 'unknown'
  const hit = events.some((e) => icalDay(e.DTSTART || e['DTSTART;VALUE=DATE']) === day && !NOT_A_HOLD.test(e.SUMMARY || ''))
  return hit ? 'held' : 'open'
}

function prettyDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const btn = (href: string, label: string, primary: boolean) =>
  `<a href="${href}" style="display:block;margin:0 0 10px;padding:15px 24px;text-align:center;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;${primary ? `background:${GOLD};color:#ffffff;` : `background:#ffffff;color:${GOLD};border:1px solid ${GOLD};`}">${label}</a>`

function buildEmail(first: string, day: string, status: 'open' | 'held' | 'unknown') {
  const text = 'font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#555;'
  // Airy paragraphs, a "your date" card and hairline rules (no ornaments).
  const roomy = 'margin:0 0 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#555;'
  const rule = `<div style="border-top:1px solid #e5ddcf;margin:30px 0;"></div>`
  const label = 'font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#8a7a62;'
  // The date sentence in the opening paragraph: open, maybe reserved, or left out when there is no date to check.
  let availHtml = ''
  let availText = ''
  let dateCard = ''
  if ((status === 'open' || status === 'held') && day) {
    const open = status === 'open'
    availHtml = open ? ` ${esc(prettyDay(day))}, is currently available.` : ` ${esc(prettyDay(day))} may already be reserved, but we’d love to help you find a date that works.`
    availText = open ? ` ${prettyDay(day)}, is currently available.` : ` ${prettyDay(day)} may already be reserved, but we’d love to help you find a date that works.`
    dateCard = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 30px;"><tr><td style="background:#f4ede1;border-left:3px solid ${GOLD};padding:16px 20px;">
<div style="${label}">Your date</div>
<div style="margin-top:4px;font-family:Georgia,serif;font-size:21px;color:#2a2420;">${esc(prettyDay(day))}</div>
<div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;color:${open ? GOLD : '#b45309'};">${open ? '&#10003; Currently Available' : 'May already be reserved'}</div>
</td></tr></table>`
  }
  const opening = 'Thanks for considering North Star House for your wedding!'
  const below = 'Below you’ll find pricing, what’s included in the rental, and a link to book a tour if you’d like to come explore the estate with us.'
  const paras = [
    'The wedding rental is $5,000 and gives you exclusive use of the estate for 10 hours. If you decide North Star House is the right fit, reserving your date is as simple as signing the venue agreement and paying an $800 retainer that goes toward the rental fee.',
    'Tables and chairs are included, and the courtyard and East Lawn are already strung with lights. You can host cocktails in the courtyard and dinner on the lawn, or use the spaces in whatever way feels right for your day.',
    'You’re welcome to bring your own vendors, whether you already have a favorite caterer in mind or are still figuring out what you’d like. We’re happy to share recommendations if you’d like a few ideas.',
    'We’d love to show you around and hear what you’re envisioning!',
  ]
  const html = `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${GOLD};"></div><div style="padding:44px 40px 36px;">
<div style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:${GOLD};font-weight:bold;margin-bottom:14px;">North Star House</div>
<h1 style="margin:0 0 22px;text-align:center;font-size:29px;font-weight:400;color:#2a2420;">Thank You for Your Inquiry</h1>
<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>
<p style="${roomy}">Hi ${esc(first)},</p>
<p style="${roomy}">${esc(opening)}${availHtml} ${esc(below)}</p>
${dateCard}
${paras.slice(0, 3).map((t) => `<p style="${roomy}">${esc(t)}</p>`).join('\n')}
${rule}
<p style="margin:0 0 30px;text-align:center;font-family:Georgia,serif;font-size:19px;line-height:1.5;color:#2a2420;"><i>${esc(paras[3])}</i></p>
<div style="margin:0 0 12px;">${btn(TOUR_PAGE('wedding'), 'Book a Tour', true)}</div>
<div style="border-top:1px solid #e5ddcf;width:60%;margin:30px auto 22px;"></div>
<p style="margin:0;text-align:center;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email. We're happy to help.</i></p>
</div></div></div>`
  const body = `Hi ${first},\n\n${opening}${availText} ${below}\n\n${paras.slice(0, 3).join('\n\n')}\n\n${paras[3]}\n\nBook a tour: ${TOUR_PAGE('wedding')}\n\n\nQuestions? Just reply to this email. We're happy to help.\n\nNorth Star House`
  return { html, body }
}

// Event, memorial and nonprofit follow-ups: written for that audience, with the same facts and pricing the website shows
// (copied from the site's pages: src/content/defaults/privateEvents.js, memorials.js and nonprofit.js in the website repo;
// update these if the site's copy or rates change). Same Book a Tour button on all of them.
type Row = { a: string; b: string; c?: string }
const EVENT_TYPES: [string, string][] = [
  ['Holiday Parties', 'Celebrate the season somewhere with a little more character. From intimate company dinners to larger community gatherings, North Star House offers a warm, distinctive setting year-round.'],
  ['Corporate Events', 'Step outside the conference room. North Star House offers a refreshing setting for company retreats, team gatherings, networking events, presentations, and client celebrations.'],
  ['Private Dinners', 'Host an unforgettable dinner surrounded by historic architecture, gardens, and the character of a century-old estate. Ideal for birthdays, anniversaries, rehearsal dinners, and intimate celebrations.'],
  ['Showers & Celebrations', 'Baby showers, bridal showers, engagement parties, birthdays, and milestone moments all feel a little more special here. Choose from indoor and outdoor spaces to create a gathering that feels entirely your own.'],
  ['Something Else in Mind?', "Family reunions, workshops, retreats, or a gathering that doesn't fit neatly into a category. Tell us what you're imagining, and we'll help you find the right space and plan at North Star House."],
]
const PRIVATE_RATES: Row[] = [{ a: 'Saturday', b: '$1,200' }, { a: 'Sunday', b: '$1,000' }, { a: 'Weekdays', b: '$800' }]
const PRIVATE_NOTE = 'Each rental is 6 hours on site, between 10 AM and 10 PM. Extra hours are $150 each. Private event dates can be booked up to 8 months in advance.'
const MEMORIAL_RATES: Row[] = [{ a: 'Friday', b: '$400' }, { a: 'Saturday', b: '$800' }, { a: 'Sunday', b: '$600' }]
const NONPROFIT_RATES: Row[] = [
  { a: 'Large Private Event', b: '$800', c: 'Up to 200 guests, 4 hours. Each extra hour $150.' },
  { a: 'Small Private Event', b: '$600', c: 'Up to 50 guests, 4 hours. Each extra hour $150.' },
  { a: 'Public Event', b: '$2,000', c: 'Permit capacity, 6 hours. Each extra hour $300.' },
]

const P = 'font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#555;'
const H3 = 'margin:26px 0 8px;font-family:Georgia,serif;font-size:19px;font-weight:400;color:#2a2420;'
const para = (t: string) => `<p style="${P}">${esc(t)}</p>`
const rateTable = (rows: Row[]) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 14px;border-collapse:collapse;">${rows.map((r) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e5ddcf;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#2a2420;"><strong>${esc(r.a)}</strong>${r.c ? `<br><span style="font-size:13px;color:#777;">${esc(r.c)}</span>` : ''}</td><td style="padding:10px 0;border-bottom:1px solid #e5ddcf;text-align:right;font-family:Georgia,serif;font-size:20px;color:${GOLD};white-space:nowrap;">${esc(r.b)}</td></tr>`).join('')}</table>`
const rateText = (rows: Row[]) => rows.map((r) => `- ${r.a}: ${r.b}${r.c ? ' (' + r.c + ')' : ''}`).join('\n')

const KIND_COPY: Record<Exclude<Kind, 'wedding'>, { greeting: string; intro: string; learn: [string, string]; sectionsHtml: string; sectionsText: string }> = {
  event: {
    greeting: 'Thank you for your interest in hosting an event at North Star House.',
    intro: "We'd love for you to see the house and grounds in person, so you can picture your gathering here and we can talk through what you have in mind. One rental gives you exclusive use of the house and grounds for your day.",
    learn: ['Learn About Events', '/private-events'],
    sectionsHtml:
      `<h3 style="${H3}">What You Can Host Here</h3>` +
      EVENT_TYPES.map(([t, d]) => `<p style="${P}margin:0 0 12px;"><strong style="color:#2a2420;">${esc(t)}.</strong> ${esc(d)}</p>`).join('') +
      `<h3 style="${H3}">Private Event Pricing</h3>` + rateTable(PRIVATE_RATES) + para(PRIVATE_NOTE) + para("Rates for other kinds of events depend on size and type. We're happy to go over them with you on your tour or by reply.") +
      `<h3 style="${H3}">Every Event Preserves the House</h3>` + para('Revenue from weddings, private gatherings, programs, and community events supports the ongoing preservation, restoration, and care of the property. When you host something here, you are helping protect a piece of local history.'),
    sectionsText:
      'WHAT YOU CAN HOST HERE\n' + EVENT_TYPES.map(([t, d]) => `- ${t}: ${d}`).join('\n') +
      '\n\nPRIVATE EVENT PRICING\n' + rateText(PRIVATE_RATES) + '\n' + PRIVATE_NOTE + "\nRates for other kinds of events depend on size and type. We're happy to go over them with you on your tour or by reply." +
      '\n\nEVERY EVENT PRESERVES THE HOUSE\nRevenue from weddings, private gatherings, programs, and community events supports the ongoing preservation, restoration, and care of the property.',
  },
  memorial: {
    greeting: 'Thank you for contacting us about a memorial or celebration of life at North Star House.',
    intro: 'With the historic Julia Morgan-designed house, Heritage Garden, courtyard, and surrounding grounds, families have the flexibility to create a gathering that feels personal. Whether that means sharing a meal, displaying photographs, gathering in the garden, playing meaningful music, or simply spending time together, the estate offers room to make the day your own.',
    learn: ['About Memorials', '/memorials'],
    sectionsHtml:
      `<h3 style="${H3}">A Special Memorial Rate for Our Community</h3>` +
      para('We believe families should have access to a beautiful, welcoming place to gather without the cost of a traditional private event rental. To help, we offer a special memorial rental option for dates within the upcoming three months. This rolling booking window lets us open dates that remain available on our event calendar at a lower rate.') +
      rateTable(MEMORIAL_RATES) + para('Each rental is 4 hours, and memorial dates are booked up to 3 months in advance.'),
    sectionsText:
      'A SPECIAL MEMORIAL RATE FOR OUR COMMUNITY\nWe believe families should have access to a beautiful, welcoming place to gather without the cost of a traditional private event rental. To help, we offer a special memorial rental option for dates within the upcoming three months. This rolling booking window lets us open dates that remain available on our event calendar at a lower rate.\n\n' +
      rateText(MEMORIAL_RATES) + '\n\nEach rental is 4 hours, and memorial dates are booked up to 3 months in advance.',
  },
  nonprofit: {
    greeting: "Thank you for your interest in hosting your organization's event at North Star House.",
    intro: "North Star House is operated by the North Star Historic Conservancy, a 501(c)(3) nonprofit, and we love supporting other nonprofits with an accessible, low-cost place to gather. Nonprofit organizations can rent the historic house, courtyard, gardens, and grounds at a reduced rate for private and public events.",
    learn: ['Nonprofit Rentals', '/nonprofit'],
    sectionsHtml:
      `<h3 style="${H3}">Nonprofit Pricing</h3>` + para('Saturday and Sunday rates:') + rateTable(NONPROFIT_RATES) +
      para("To keep pricing low and manage availability fairly across the estate's full calendar, nonprofit bookings open on a 6-month advance window."),
    sectionsText:
      'NONPROFIT PRICING (Saturday and Sunday)\n' + rateText(NONPROFIT_RATES) +
      "\n\nTo keep pricing low and manage availability fairly across the estate's full calendar, nonprofit bookings open on a 6-month advance window.",
  },
}
function buildKindEmail(first: string, kind: Exclude<Kind, 'wedding'>) {
  const c = KIND_COPY[kind]
  const html = `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${GOLD};"></div><div style="padding:40px 36px 34px;">
<div style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:${GOLD};font-weight:bold;margin-bottom:14px;">North Star House</div>
<h1 style="margin:0 0 22px;text-align:center;font-size:29px;font-weight:400;color:#2a2420;">Thank You for Your Inquiry</h1>
<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>
<p style="${P}">Hi ${esc(first)},</p>
${para(c.greeting)}
${para(c.intro)}
<div style="margin:24px 0 8px;">${btn(TOUR_PAGE(kind), 'Book a Tour', true)}</div>
${c.sectionsHtml}
<div style="margin:22px 0 0;">${btn(SITE + c.learn[1], esc(c.learn[0]), false)}</div>
<p style="margin:26px 0 0;text-align:center;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email. We're happy to help.</i></p>
</div></div></div>`
  const body = `Hi ${first},\n\n${c.greeting}\n\n${c.intro}\n\nBook a tour: ${TOUR_PAGE(kind)}\n\n${c.sectionsText}\n\n${c.learn[0]}: ${SITE}${c.learn[1]}\n\nQuestions? Just reply to this email. We're happy to help.\n\nNorth Star House`
  return { html, body }
}

// The name and email questions on the non-wedding forms have their own ids, so find them by their labels.
async function formFieldIds(formIds: string[]) {
  const forms: { id: string; fields: { id: string; label?: string }[] }[] = await rest(`nsh_forms?select=id,fields&id=in.(${formIds.join(',')})`)
  const out: Record<string, { name?: string; email?: string }> = {}
  for (const f of forms) {
    const fields = f.fields || []
    const name = fields.find((q) => /name/i.test(q.label || '') && !/partner|organi[sz]ation|business|company|event|group/i.test(q.label || '')) || fields.find((q) => /name/i.test(q.label || ''))
    const email = fields.find((q) => /e-?mail/i.test(q.label || ''))
    out[f.id] = { name: name?.id, email: email?.id }
  }
  return out
}

Deno.serve(async () => {
  const out = { checked: 0, sent: 0, skipped: 0, errors: 0 }
  try {
    const now = Date.now()
    const newest = new Date(now - 48 * 3600_000).toISOString()
    const oldest = new Date(Math.max(Date.parse(FOLLOWUP_START), now - MAX_AGE_DAYS * 86400_000)).toISOString()
    const rows: any[] = await rest(`nsh_form_responses?select=id,form_id,answers,created_at,status&form_id=in.(${Object.keys(FORM_KIND).join(',')})&archived_at=is.null&created_at=gte.${encodeURIComponent(oldest)}&created_at=lte.${encodeURIComponent(newest)}&order=created_at.asc&limit=60`)
    if (!rows.length) return Response.json(out)

    const done: { response_id: string; email: string }[] = await rest('inquiry_followups?select=response_id,email')
    const doneIds = new Set(done.map((d) => d.response_id))
    const doneEmails = new Set(done.map((d) => d.email.toLowerCase()))

    const fieldIds = await formFieldIds(Object.keys(FORM_KIND).filter((f) => f !== WEDDING_FORM_ID))
    let events: Record<string, string>[] | null = null
    try { events = (await rest('calendar_events_cache?select=events&id=eq.1'))[0]?.events || null } catch { events = null }

    for (const r of rows) {
      out.checked++
      const a = r.answers || {}
      const kind: Kind = FORM_KIND[r.form_id] || 'event'
      const ids = kind === 'wedding' ? { name: 'w_name', email: 'w_email' } : fieldIds[r.form_id] || {}
      const email = String((ids.email && a[ids.email]) || '').trim()
      if (r.status === 'handled' || !validEmail(email) || doneIds.has(r.id) || doneEmails.has(email.toLowerCase())) { out.skipped++; continue }
      try {
        const lit = encodeURIComponent(email.toLowerCase().replace(/[\\%_*]/g, '\\$&'))
        const tours = await rest(`estate_tours?select=id&status=in.(booked,requested)&visitor_email=ilike.${lit}&limit=1`)
        const client = await rest(`venue_inquiries?select=id&email=ilike.${lit}&limit=1`)
        if (tours.length || client.length) { out.skipped++; continue }

        const first = String((ids.name && a[ids.name]) || '').trim().split(/\s+/)[0] || 'there'
        // Only a wedding date is checked against the calendar; the other kinds just get the tour invitation.
        const day = kind === 'wedding' ? String(a.w_date || '') : ''
        const status = kind === 'wedding' ? await dateStatus(day, events) : 'unknown'
        const { html, body } = kind === 'wedding' ? buildEmail(first, day, status) : buildKindEmail(first, kind)

        // Claim first so an overlapping run can't send it twice.
        await rest('inquiry_followups', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ response_id: r.id, email: email.toLowerCase(), date_status: status }) })
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ to: email, subject: 'Thank you for your North Star House inquiry', body, html, sender: 'Venue Team', fromEmail: 'venue@northstarhouse.org' }),
        })
        if (!res.ok) {
          await rest(`inquiry_followups?response_id=eq.${r.id}`, { method: 'DELETE' }) // let the next run retry
          throw new Error(`send-email HTTP ${res.status}`)
        }
        out.sent++
      } catch (e) { console.error('inquiry follow-up failed', r.id, e instanceof Error ? e.message : e); out.errors++ }
    }
    return Response.json(out)
  } catch (e) {
    console.error('send-inquiry-followups', e instanceof Error ? e.message : e)
    return Response.json({ ...out, error: 'failed' }, { status: 500 })
  }
})
