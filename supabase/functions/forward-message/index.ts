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
    if (!emails.length) return json({ error: `No email address found for ${LABELS[to]}.` }, 404)

    const by = String(b.by || '').trim().slice(0, 60)
    const note = String(b.note || '').trim().slice(0, 1000)
    const lines = [
      `${by || 'Someone on the team'} forwarded this to ${LABELS[to]}.`,
      ...(note ? ['', `Note: ${note}`] : []),
      '',
      `From: ${String(m.from || 'Unknown caller').slice(0, 120)}`,
      ...(m.phone ? [`Phone: ${String(m.phone).slice(0, 40)}`] : []),
      ...(m.when ? [`Received: ${String(m.when).slice(0, 80)}`] : []),
      '',
      text,
    ]
    const subject = `Voicemail from ${String(m.from || 'a caller').slice(0, 80)}`
    const r = await fetch(`${URL_}/functions/v1/send-email`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: emails, subject, body: lines.join('\n'), fromEmail: 'venue@northstarhouse.org' }),
    })
    if (!r.ok) return json({ error: 'The email could not be sent. Please try again.' }, 502)
    return json({ ok: true, sent_to: emails.length, label: LABELS[to] })
  } catch (err) {
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500)
  }
})
