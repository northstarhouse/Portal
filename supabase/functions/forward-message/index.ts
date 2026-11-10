// Forward a message (voicemail) from the Portal's Messages tab to a person or group on the team.
// Only a signed-in Portal session may call it. Recipients are looked up here, not sent by the browser, so the Portal
// can only forward to the people on the list below.
//
// POST { to: 'docents' | 'kaelen' | 'ken', message: { title, from, phone, when, text }, note?, by? }
//   docents -> every active volunteer on the Docents team (Team or Event Tags mention "docent")
//   kaelen  -> Kaelen Jennings, ken -> Ken Underwood (emails read from the volunteer list)

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`)
  return data
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

// Same branded look as the Portal's other venue emails (send-email's brandPlain).
const LOGO_URL = 'https://northstarhouse.github.io/venue/assets/logo.png'
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function voicemailHtml(from: string, phone: string, when: string, text: string) {
  const row = (k: string, v: string) => v ? `<tr><td style="padding:5px 0;font-size:13px;color:#888;width:90px;vertical-align:top;">${k}</td><td style="padding:5px 0;font-size:15px;color:#2a2420;">${esc(v)}</td></tr>` : ''
  return `<div style="background:#f7f3ec;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e8e0d5;overflow:hidden;">
<div style="background:#6b5232;padding:22px;text-align:center;"><img src="${LOGO_URL}" alt="North Star House" width="170" style="display:block;margin:0 auto;max-width:170px;height:auto;"></div>
<div style="height:4px;background:#886c44;"></div>
<div style="padding:30px 36px;"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#2a2420;">Voicemail</h1>
<table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 18px;">${row('From', from)}${row('Phone', phone)}${row('Received', when)}</table>
<div style="background:#faf6ef;border-left:3px solid #886c44;padding:14px 18px;font-size:15px;line-height:1.6;color:#444;">${esc(text).replace(/\n/g, '<br>')}</div></div>
<div style="background:#f7f3ec;padding:16px 36px;border-top:1px solid #e8e0d5;text-align:center;font-size:11px;color:#999;">North Star House</div></div></div>`
}
const LABELS: Record<string, string> = { docents: 'the Docents', kaelen: 'Kaelen Jennings', ken: 'Ken Underwood' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405)
  try {
    const token = req.headers.get('x-app-token') || ''
    if (!token) return json({ error: 'Staff sign-in required.' }, 403)
    const ok = await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': token }, body: '{}' })
    if (ok !== true) return json({ error: 'Staff session expired. Sign in again.' }, 403)

    const b = await req.json()
    const to = String(b.to || '')
    if (!LABELS[to]) return json({ error: 'Choose who to forward to.' }, 400)
    const m = b.message || {}
    const text = String(m.text || '').trim().slice(0, 4000)
    if (!text) return json({ error: 'There is nothing to forward.' }, 400)

    // Every attempt is written to the Activity Log (sent or not), with who forwarded it and who was signed in,
    // so "did that voicemail go out?" always has an answer. Shown in Tools > Activity log.
    const by0 = String(b.by || '').trim().slice(0, 60)
    const signedIn = (await rest(`app_sessions?select=actor_name&token=eq.${encodeURIComponent(token)}`).catch(() => []))?.[0]?.actor_name || null
    const caller = String(m.from || 'a caller').slice(0, 80)
    const logAttempt = (sent: boolean, extra: Record<string, unknown>) => rest('activity_log', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        action: sent ? 'voicemail_forwarded' : 'voicemail_forward_failed',
        tag: 'Voicemail',
        description: sent ? `Voicemail from ${caller} forwarded to ${LABELS[to]}${by0 ? ' by ' + by0 : ''}` : `Voicemail from ${caller} could NOT be forwarded to ${LABELS[to]}${by0 ? ' (' + by0 + ')' : ''}`,
        detail: { by: by0 || null, signed_in: signedIn, to, message_id: m.id ?? null, ...extra },
      }),
    }).catch(() => {})

    const people = await rest('2026 Volunteers?select=' + encodeURIComponent('"First Name","Last Name",Email,Team,Status,"Event Tags"'))
    const active = (people || []).filter((p: Record<string, string>) => String(p.Status || '').toLowerCase() === 'active' && EMAIL.test(String(p.Email || '').trim()))
    let emails: string[]
    if (to === 'docents') {
      emails = active.filter((p: Record<string, string>) => /docent/i.test(`${p.Team || ''} ${p['Event Tags'] || ''}`)).map((p: Record<string, string>) => String(p.Email).trim())
    } else {
      const [first, last] = to === 'kaelen' ? ['kaelen', 'jennings'] : ['ken', 'underwood']
      emails = active.filter((p: Record<string, string>) => String(p['First Name'] || '').trim().toLowerCase() === first && String(p['Last Name'] || '').trim().toLowerCase() === last).map((p: Record<string, string>) => String(p.Email).trim())
    }
    emails = [...new Set(emails.map((e) => e.toLowerCase()))]
    if (!emails.length) { await logAttempt(false, { error: 'no email address found' }); return json({ error: `No email address found for ${LABELS[to]}.` }, 404) }

    // The email carries only the voicemail itself: no "forwarded by" line and no internal handling notes.
    const from = String(m.from || 'Unknown caller').slice(0, 120)
    const phone = m.phone ? String(m.phone).slice(0, 40) : ''
    const when = m.when ? String(m.when).slice(0, 80) : ''
    const lines = [`From: ${from}`, ...(phone ? [`Phone: ${phone}`] : []), ...(when ? [`Received: ${when}`] : []), '', text]
    const subject = `Voicemail from ${String(m.from || 'a caller').slice(0, 80)}`
    const r = await fetch(`${URL_}/functions/v1/send-email`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: emails, subject, body: lines.join('\n'), html: voicemailHtml(from, phone, when, text), fromEmail: 'venue@northstarhouse.org' }),
    })
    if (!r.ok) { await logAttempt(false, { error: `email service ${r.status}: ${(await r.text()).slice(0, 200)}` }); return json({ error: 'The email could not be sent. Please try again.' }, 502) }
    await logAttempt(true, { sent_to: emails })
    return json({ ok: true, sent_to: emails.length, label: LABELS[to] })
  } catch (err) {
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500)
  }
})
