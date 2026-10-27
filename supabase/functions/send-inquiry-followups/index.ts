// 48-hour follow-up for website wedding inquiries. If someone filled out the Wedding Inquiry form and,
// two days later, has neither booked nor requested a tour, they get one branded email with: whether their
// date looks open, pricing basics, short answers to the most common questions, and buttons to book a
// tour / see pricing / read the FAQ. Run hourly by pg_cron (see add_inquiry_followups.sql).
//
// Safe to run any number of times: each inquiry is claimed in inquiry_followups (primary key = response id)
// before the email goes out, and the same email address is never followed up twice.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEDDING_FORM_ID = '1eea2137-f94d-414b-a977-4ed622214580'
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
  const h3 = `margin:26px 0 8px;font-family:Georgia,serif;font-size:19px;font-weight:400;color:#2a2420;`
  let availHtml = ''
  let availText = ''
  if (status === 'open' && day) {
    availHtml = `<p style="${text}">Good news: <strong>${esc(prettyDay(day))}</strong> is currently open on our calendar. Dates are held only once a contract is signed, so we'd love to show you the property before someone else does.</p>`
    availText = `Good news: ${prettyDay(day)} is currently open on our calendar. Dates are held only once a contract is signed, so we'd love to show you the property before someone else does.`
  } else if (status === 'held' && day) {
    availHtml = `<p style="${text}">The date you asked about, <strong>${esc(prettyDay(day))}</strong>, looks like it may already be reserved. We'd still love to help you find a date that works. Book a tour or reply to this email and we'll go over what's open around your dates.</p>`
    availText = `The date you asked about, ${prettyDay(day)}, looks like it may already be reserved. We'd still love to help you find a date that works. Book a tour or reply to this email and we'll go over what's open around your dates.`
  }
  const html = `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:${GOLD};"></div><div style="padding:44px 40px 36px;">
<div style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:${GOLD};font-weight:bold;margin-bottom:14px;">NORTH STAR HOUSE</div>
<h1 style="margin:0 0 22px;text-align:center;font-size:29px;font-weight:400;color:#2a2420;">Thank You for Your Inquiry</h1>
<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>
<p style="${text}">Hi ${esc(first)},</p>
<p style="${text}">Thank you for reaching out about a wedding at North Star House. We're so glad you found us. Here is a quick look at what you asked about.</p>
${availHtml}
<div style="margin:24px 0 8px;">${btn(`${SITE}/weddings#inquiry`, 'Book a Tour', true)}</div>
<h3 style="${h3}">Pricing</h3>
<p style="${text}"><strong>$5,000</strong>, one price. It makes the estate yours for the day. A non-refundable <strong>$800 retainer</strong> reserves your date and counts toward the total, and an <strong>$800 refundable security deposit</strong> is due one month before your wedding.</p>
${btn(`${SITE}/weddings`, 'View Pricing &amp; Details', false)}
<h3 style="${h3}">Common Questions</h3>
<p style="${text}"><strong>How do I reserve my date?</strong><br>Sign the venue agreement and pay the $800 retainer, which counts toward your total.</p>
<p style="${text}"><strong>Is the security deposit refundable?</strong><br>Yes. It is returned after your event if there is no damage and policies are followed.</p>
<p style="${text}"><strong>Do we need insurance?</strong><br>Yes, a $1 million liability policy naming North Star Historic Conservancy as additionally insured. These policies are typically inexpensive for a single event.</p>
${btn(`${SITE}/weddings#faq`, 'Read the Full Q&amp;A', false)}
<p style="margin:26px 0 0;text-align:center;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email. We're happy to help.</i></p>
</div></div></div>`
  const body = `Hi ${first},\n\nThank you for reaching out about a wedding at North Star House. We're so glad you found us.\n\n${availText ? availText + '\n\n' : ''}Book a tour: ${SITE}/weddings#inquiry\n\nPRICING\n$5,000, one price. A non-refundable $800 retainer reserves your date and counts toward the total, and an $800 refundable security deposit is due one month before your wedding.\nPricing & details: ${SITE}/weddings\n\nCOMMON QUESTIONS\nHow do I reserve my date? Sign the venue agreement and pay the $800 retainer.\nIs the security deposit refundable? Yes, if there is no damage and policies are followed.\nDo we need insurance? Yes, a $1 million liability policy naming North Star Historic Conservancy as additionally insured.\nFull Q&A: ${SITE}/weddings#faq\n\nQuestions? Just reply to this email.\n\nNorth Star House`
  return { html, body }
}

Deno.serve(async () => {
  const out = { checked: 0, sent: 0, skipped: 0, errors: 0 }
  try {
    const now = Date.now()
    const newest = new Date(now - 48 * 3600_000).toISOString()
    const oldest = new Date(Math.max(Date.parse(FOLLOWUP_START), now - MAX_AGE_DAYS * 86400_000)).toISOString()
    const rows: any[] = await rest(`nsh_form_responses?select=id,answers,created_at,status&form_id=eq.${WEDDING_FORM_ID}&archived_at=is.null&created_at=gte.${encodeURIComponent(oldest)}&created_at=lte.${encodeURIComponent(newest)}&order=created_at.asc&limit=60`)
    if (!rows.length) return Response.json(out)

    const done: { response_id: string; email: string }[] = await rest('inquiry_followups?select=response_id,email')
    const doneIds = new Set(done.map((d) => d.response_id))
    const doneEmails = new Set(done.map((d) => d.email.toLowerCase()))

    let events: Record<string, string>[] | null = null
    try { events = (await rest('calendar_events_cache?select=events&id=eq.1'))[0]?.events || null } catch { events = null }

    for (const r of rows) {
      out.checked++
      const a = r.answers || {}
      const email = String(a.w_email || '').trim()
      if (r.status === 'handled' || !validEmail(email) || doneIds.has(r.id) || doneEmails.has(email.toLowerCase())) { out.skipped++; continue }
      try {
        const lit = encodeURIComponent(email.toLowerCase().replace(/[\\%_*]/g, '\\$&'))
        const tours = await rest(`estate_tours?select=id&status=in.(booked,requested)&visitor_email=ilike.${lit}&limit=1`)
        const client = await rest(`venue_inquiries?select=id&email=ilike.${lit}&limit=1`)
        if (tours.length || client.length) { out.skipped++; continue }

        const day = String(a.w_date || '')
        const status = await dateStatus(day, events)
        const first = String(a.w_name || '').trim().split(/\s+/)[0] || 'there'
        const { html, body } = buildEmail(first, day, status)

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
