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

const TOUR_DIRECTIONS_TEXT = `When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house for your tour.

Apple Maps users: Make sure your directions are taking you to Auburn Road, not Allison Ranch Road — that route is incorrect and won't lead to the proper entrance. We have been working with Maps to correct this.

Enter through the courtyard to arrive at the front door of the estate — your coordinator will meet you in this general area.`

const TOUR_DIRECTIONS_HTML = `<p>When you arrive, please enter through the main gate on Auburn Road and disregard any event parking signs. You're welcome to park directly in front of the house for your tour.</p><p><strong>Apple Maps users:</strong> Make sure your directions are taking you to Auburn Road, not Allison Ranch Road — that route is incorrect and won't lead to the proper entrance. We have been working with Maps to correct this.</p><p>Enter through the courtyard to arrive at the front door of the estate — your coordinator will meet you in this general area.</p>`

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
      `Hi ${t.visitor_name},\n\nJust a reminder — your estate tour is tomorrow, ${when} (about 45 minutes).\n\n${TOUR_DIRECTIONS_TEXT}\n\nSee you then!\nNorth Star House`,
      `<p>Hi ${esc(t.visitor_name)},</p><p>Just a reminder — your estate tour is tomorrow, <strong>${esc(when)}</strong> (about 45 minutes).</p>${TOUR_DIRECTIONS_HTML}<p>See you then!<br>North Star House</p>`
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
      `Hi ${t.visitor_name},\n\nYour estate tour is coming up shortly — ${when} (about 45 minutes).\n\n${TOUR_DIRECTIONS_TEXT}\n\nSee you soon!\nNorth Star House`,
      `<p>Hi ${esc(t.visitor_name)},</p><p>Your estate tour is coming up shortly — <strong>${esc(when)}</strong> (about 45 minutes).</p>${TOUR_DIRECTIONS_HTML}<p>See you soon!<br>North Star House</p>`
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
