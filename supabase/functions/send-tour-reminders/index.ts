// Sends the 24h-before and 1h-before reminder emails for booked estate tours.
// Invoked on a schedule (pg_cron -> pg_net, every 15 min — see the
// 20260904c_estate_tours_reminders.sql migration in nsh-bcopy). Idempotent:
// only ever touches rows whose reminder_*_sent_at is still null, and marks a
// row sent right after a successful send, so overlapping cron runs can never
// double-send to the same visitor.
//
// "Due" is computed in Postgres (tours_due_for_24h_reminder / _1h_reminder
// RPCs), which does the America/Los_Angeles wall-clock -> UTC conversion —
// estate_tours.date/start_time are stored as plain local values with no
// timezone, same as everywhere else this data is displayed.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const WEBSITE_URL = 'https://www.northstarhouse.org'
const GOLD = '#886c44'
const TOUR_ADDRESS = '12075 Auburn Rd. Grass Valley, CA 95949'

// <br>-separated (not <p>) — gets embedded inside buildBrandedEmailHtml's own
// single <p> wrapper, so nested block tags would be invalid HTML.
const TOUR_DIRECTIONS_HTML_INLINE =
  `When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house for your tour.<br><br>` +
  `<strong>Apple Maps users:</strong> Make sure your directions are taking you to Auburn Road, not Allison Ranch Road — that route is incorrect and won't lead to the proper entrance. We have been working with Maps to correct this.<br><br>` +
  `Enter through the courtyard to arrive at the front door of the estate — your coordinator will meet you in this general area.`

const TOUR_DIRECTIONS_TEXT = `When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house for your tour.

Apple Maps users: Make sure your directions are taking you to Auburn Road, not Allison Ranch Road — that route is incorrect and won't lead to the proper entrance. We have been working with Maps to correct this.

Enter through the courtyard to arrive at the front door of the estate — your coordinator will meet you in this general area.`

const TOUR_EMAIL_FOOTER_LINKS = [
  { label: 'Website', url: `${WEBSITE_URL}/` },
  { label: 'Reschedule', url: 'mailto:info@northstarhouse.org?subject=Reschedule%20My%20Estate%20Tour' },
  { label: 'Directions', url: `${WEBSITE_URL}/directions-parking` },
]

// Branded HTML shell matching north-star-portal's own template (gold top bar,
// serif headline, gold CTA button, footer links) — ported from
// buildBoardNotificationEmailHtml in src/app.jsx so every email the org sends
// looks the same regardless of which app sent it.
function buildBrandedEmailHtml(opts: { headline: string; subtext: string; buttonText?: string; buttonUrl?: string; note?: string }) {
  const { headline, subtext, buttonText, buttonUrl, note } = opts
  const links = TOUR_EMAIL_FOOTER_LINKS
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

function esc(s: string) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
}

function fmtWhen(date: string, time: string) {
  const d = new Date(`${date}T${time}`)
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  return `${day} at ${t}`
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
    body: JSON.stringify({ from: 'Estate Tours · North Star House <info@northstarhouse.org>', to: [to], subject, text, html }),
  })
  return res.ok
}

type Tour = { id: string; visitor_name: string; visitor_email: string; date: string; start_time: string }

async function run24h(): Promise<number> {
  const rows: Tour[] = await sb('/rest/v1/rpc/tours_due_for_24h_reminder', { method: 'POST', body: '{}' }).then((r) => r.json())
  let sent = 0
  for (const t of rows || []) {
    const when = fmtWhen(t.date, t.start_time)
    const ok = await sendMail(
      t.visitor_email,
      `Reminder: your North Star House tour is tomorrow — ${when}`,
      `Hi ${t.visitor_name},\n\nJust a reminder — your estate tour is tomorrow.\n\nTour Date & Time: ${when}\nAddress: ${TOUR_ADDRESS}\n\n${TOUR_DIRECTIONS_TEXT}\n\nSee you then!\nNorth Star House`,
      buildBrandedEmailHtml({
        headline: 'Your Tour is Tomorrow',
        subtext:
          `Hi ${esc(t.visitor_name)}, just a reminder — your estate tour is tomorrow:<br><br>` +
          `Tour Date &amp; Time: <strong>${esc(when)}</strong><br>` +
          `Address: <strong>${esc(TOUR_ADDRESS)}</strong><br><br>` +
          TOUR_DIRECTIONS_HTML_INLINE,
      })
    )
    if (ok) {
      await sb(`/rest/v1/estate_tours?id=eq.${t.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ reminder_24h_sent_at: new Date().toISOString() }),
      })
      sent++
    }
  }
  return sent
}

async function run1h(): Promise<number> {
  const rows: Tour[] = await sb('/rest/v1/rpc/tours_due_for_1h_reminder', { method: 'POST', body: '{}' }).then((r) => r.json())
  let sent = 0
  for (const t of rows || []) {
    const when = fmtWhen(t.date, t.start_time)
    const ok = await sendMail(
      t.visitor_email,
      `Your North Star House tour is in about an hour`,
      `Hi ${t.visitor_name},\n\nYour estate tour is coming up shortly.\n\nTour Date & Time: ${when}\nAddress: ${TOUR_ADDRESS}\n\n${TOUR_DIRECTIONS_TEXT}\n\nSee you soon!\nNorth Star House`,
      buildBrandedEmailHtml({
        headline: 'See You Soon!',
        subtext:
          `Hi ${esc(t.visitor_name)}, your estate tour is coming up shortly:<br><br>` +
          `Tour Date &amp; Time: <strong>${esc(when)}</strong><br>` +
          `Address: <strong>${esc(TOUR_ADDRESS)}</strong><br><br>` +
          TOUR_DIRECTIONS_HTML_INLINE,
      })
    )
    if (ok) {
      await sb(`/rest/v1/estate_tours?id=eq.${t.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ reminder_1h_sent_at: new Date().toISOString() }),
      })
      sent++
    }
  }
  return sent
}

Deno.serve(async () => {
  try {
    const [sent24, sent1] = await Promise.all([run24h(), run1h()])
    return new Response(JSON.stringify({ ok: true, sent24, sent1 }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
