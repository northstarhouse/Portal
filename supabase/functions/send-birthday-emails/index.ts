// Sends a "Happy Birthday" email to every active volunteer whose birthday is
// today. Invoked once a day by pg_cron -> pg_net (see the
// add_volunteer_birthday_emails.sql migration, which also creates the
// volunteer_birthday_email_log dedup table this function reads/writes).
//
// "Today" is computed in America/Los_Angeles wall-clock time (NSH is in
// Grass Valley, CA), matched against the Birthday column's "MM-DD" slice --
// Birthday is stored as free-text "YYYY-MM-DD" on the "2026 Volunteers"
// table and the year is frequently a placeholder (form default), so only
// month/day is ever compared, never the year.
//
// Idempotent per calendar year: volunteer_birthday_email_log.last_sent_year
// is checked before sending and updated right after a successful send, so
// overlapping cron runs (and re-runs later the same day) can never
// double-send, and the same person gets exactly one birthday email per year.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const GOLD = '#886c44'
const WEBSITE_URL = 'https://thenorthstarhouse.org'
const VOLUNTEER_HUB_URL = 'https://northstarhouse.github.io/volunteerhub/'
const CALENDAR_PUBLIC_URL = 'https://calendar.google.com/calendar/u/0?cid=dGhlbm9ydGhzdGFyaG91c2VAZ21haWwuY29t'

// Same three links the app's other volunteer-facing emails use (see
// TEMPLATE_EMAIL_FOOTER_LINKS in src/app.jsx) -- volunteers don't have
// Portal access, so Calendar stands in for it here too.
const BIRTHDAY_EMAIL_FOOTER_LINKS = [
  { label: 'Calendar', url: CALENDAR_PUBLIC_URL },
  { label: 'Volunteer Hub', url: VOLUNTEER_HUB_URL },
  { label: 'Website', url: WEBSITE_URL },
]

// Branded HTML shell matching north-star-portal's own template (gold top
// bar, serif headline, footer links) -- ported from
// buildBoardNotificationEmailHtml in src/app.jsx, same as send-tour-reminders
// does, so every email the org sends looks the same regardless of source.
function buildBrandedEmailHtml(opts: { headline: string; subtext: string; note?: string }) {
  const { headline, subtext, note } = opts
  const links = BIRTHDAY_EMAIL_FOOTER_LINKS
  const footerCells = links
    .map((l, i) => {
      const border = i < links.length - 1 ? 'border-right:1px solid #e5ddcf;' : ''
      return `<td style="width:${(100 / links.length).toFixed(2)}%;text-align:center;padding:14px 8px;${border}"><a href="${l.url}" style="color:${GOLD};text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:13px;">${l.label}</a></td>`
    })
    .join('')
  return (
    `<div style="background:#d9cdb8;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fdfbf7;border-radius:2px;overflow:hidden;">` +
    `<div style="height:14px;background:${GOLD};"></div>` +
    `<div style="padding:48px 40px 32px;text-align:center;">` +
    `<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${headline}</h1>` +
    `<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>` +
    `<p style="margin:0 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.5;text-align:left;">${subtext}</p>` +
    (note ? `<p style="margin:20px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>${note}</i></p>` : '') +
    `</div>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse;border-top:1px solid #e5ddcf;">` +
    `<tr>${footerCells}</tr>` +
    `</table>` +
    `</div>` +
    `</div>`
  )
}

function esc(s: string) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
}

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

async function sendMail(to: string, subject: string, text: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'North Star House <info@northstarhouse.org>', to: [to], subject, text, html }),
  })
  return res.ok
}

type Volunteer = { 'First Name': string; 'Last Name': string; Email: string; Birthday: string }

function todayInLA(): { monthDay: string; year: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { monthDay: `${get('month')}-${get('day')}`, year: Number(get('year')) }
}

Deno.serve(async () => {
  try {
    const { monthDay, year } = todayInLA()

    const volunteers: Volunteer[] = await sb(
      `/rest/v1/2026%20Volunteers?select=%22First%20Name%22,%22Last%20Name%22,Email,Birthday&Status=eq.Active&Birthday=not.is.null`
    ).then((r) => r.json())

    const birthdayVolunteers = (Array.isArray(volunteers) ? volunteers : []).filter((v) => {
      const bday = (v.Birthday || '').trim()
      return bday.length >= 10 && bday.slice(5, 10) === monthDay && (v.Email || '').trim()
    })

    let sent = 0
    for (const v of birthdayVolunteers) {
      const email = v.Email.trim().toLowerCase()
      const firstName = (v['First Name'] || '').trim() || 'there'

      const logRow = await sb(`/rest/v1/volunteer_birthday_email_log?email=eq.${encodeURIComponent(email)}&select=last_sent_year`).then((r) =>
        r.json()
      )
      if (Array.isArray(logRow) && logRow[0] && logRow[0].last_sent_year === year) continue

      const ok = await sendMail(
        v.Email.trim(),
        `Happy Birthday, ${firstName}! 🎂`,
        `Everyone at North Star House is so grateful for the time and heart you give as a volunteer. We hope your day is a wonderful one!\n\nWith thanks,\nNorth Star House`,
        buildBrandedEmailHtml({
          headline: `Happy Birthday, ${esc(firstName)}! 🎂`,
          subtext: `Everyone at North Star House is so grateful for the time and heart you give as a volunteer. We hope your day is a wonderful one!<br><br>With thanks,<br>North Star House`,
        })
      )

      if (ok) {
        await sb('/rest/v1/volunteer_birthday_email_log', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ email, last_sent_year: year, sent_at: new Date().toISOString() }),
        })
        sent++
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: birthdayVolunteers.length, sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
