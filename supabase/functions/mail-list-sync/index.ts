// Constant Contact connection for the Portal (Admin > Constant Contact).
// Newsletter Sign Up and Volunteer Sign Up submissions are added to a Constant Contact list.
//
// POST { action: 'status' }                         -> { connected, newsletter_list, volunteer_list, log: [...] }
// POST { action: 'auth-url' }                       -> { url } where the person clicks Allow (comes back to constant-contact-callback)
// POST { action: 'lists' }                          -> { lists: [{ id, name }] }
// POST { action: 'save-lists', newsletter_list_id, newsletter_list_name, volunteer_list_id, volunteer_list_name }
// POST { action: 'sync', response_id }              -> adds that form response's person to the chosen list (called by a database trigger)
// POST { action: 'backfill', form: 'newsletter' | 'volunteer' } -> adds everyone who already signed up through that form
//
// Secrets: CC_CLIENT_SECRET (set with `supabase secrets set`). The client id is not secret.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('CC_CLIENT_ID') || 'e97238cc-4a50-4af1-bb40-1181d2431717'
const CLIENT_SECRET = Deno.env.get('CC_CLIENT_SECRET') || ''
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/constant-contact-callback`
const NEWSLETTER_FORM = 'ee7add8b-277c-4309-8c45-60b13b3befd3'
const VOLUNTEER_FORM = '11342c74-d0f0-4cb3-9b9e-57f30b4ae3a7'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}
async function getConn() {
  const r = await sb('/rest/v1/cc_connection?id=eq.1&select=*')
  const rows = await r.json()
  return Array.isArray(rows) ? rows[0] : null
}
async function patchConn(patch: Record<string, unknown>) {
  await sb('/rest/v1/cc_connection?id=eq.1', { method: 'PATCH', body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) })
}
async function logSync(response_id: string | null, source: string, email: string, status: string, detail: string) {
  await sb('/rest/v1/cc_sync_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ response_id, source, email, status, detail: detail.slice(0, 500) }) })
}

async function tokenRequest(form: Record<string, string>) {
  const r = await fetch('https://authz.constantcontact.com/oauth2/default/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`) },
    body: new URLSearchParams(form).toString(),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error_description || j.error || `Token request failed (${r.status})`)
  return j as { access_token: string; refresh_token?: string; expires_in?: number }
}

// A working access token, refreshed when it is about to expire.
async function accessToken() {
  const c = await getConn()
  if (!c || !c.refresh_token) throw new Error('Constant Contact is not connected yet')
  if (c.access_token && c.expires_at && new Date(c.expires_at).getTime() - Date.now() > 60_000) return c.access_token as string
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token })
  await patchConn({ access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token, expires_at: new Date(Date.now() + (t.expires_in || 7200) * 1000).toISOString() })
  return t.access_token
}

async function cc(path: string, init: RequestInit = {}) {
  const token = await accessToken()
  const r = await fetch(`https://api.cc.email/v3${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const text = await r.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { ok: r.ok, status: r.status, body }
}

const clean = (s: unknown) => String(s ?? '').trim()

// Who a form response is, depending on the form.
function personFrom(formId: string, a: Record<string, unknown>) {
  if (formId === NEWSLETTER_FORM) {
    return { email: clean(a.email).toLowerCase(), first: clean(a.first_name || a.name).split(/\s+/)[0] || '', last: '', phone: '', source: 'Newsletter Sign Up', listKey: 'newsletter_list_id' }
  }
  return { email: clean(a.v_email).toLowerCase(), first: clean(a.v_first), last: clean(a.v_last), phone: clean(a.v_phone), source: 'Volunteer Sign Up', listKey: 'volunteer_list_id' }
}

async function addPerson(conn: any, formId: string, responseId: string | null, answers: Record<string, unknown>) {
  const p = personFrom(formId, answers || {})
  if (!p.email || !/^\S+@\S+\.\S+$/.test(p.email)) { await logSync(responseId, p.source, p.email, 'skipped', 'No valid email address'); return 'skipped' }
  const listId = conn[p.listKey]
  if (!listId) { await logSync(responseId, p.source, p.email, 'skipped', 'No Constant Contact list chosen for this form yet'); return 'skipped' }
  const body: Record<string, unknown> = { email_address: p.email, list_memberships: [listId], create_source: 'Account' }
  if (p.first) body.first_name = p.first
  if (p.last) body.last_name = p.last
  if (p.phone) body.phone_number = p.phone
  const r = await cc('/contacts/sign_up_form', { method: 'POST', body: JSON.stringify(body) })
  if (r.ok) { await logSync(responseId, p.source, p.email, 'added', 'Added to ' + (conn[p.listKey.replace('_id', '_name')] || 'list')); return 'added' }
  await logSync(responseId, p.source, p.email, 'failed', `Constant Contact said ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body)}`)
  return 'failed'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }
  const action = body.action
  try {
    if (action === 'status') {
      const c = await getConn()
      const lr = await sb('/rest/v1/cc_sync_log?select=*&order=created_at.desc&limit=15')
      const log = await lr.json()
      return json({
        secret_set: !!CLIENT_SECRET,
        connected: !!(c && c.refresh_token),
        connected_at: c?.connected_at || null,
        newsletter_list: c?.newsletter_list_id ? { id: c.newsletter_list_id, name: c.newsletter_list_name } : null,
        volunteer_list: c?.volunteer_list_id ? { id: c.volunteer_list_id, name: c.volunteer_list_name } : null,
        log: Array.isArray(log) ? log : [],
      })
    }
    if (action === 'auth-url') {
      if (!CLIENT_SECRET) return json({ error: 'The Constant Contact client secret has not been stored yet.' }, 400)
      const state = crypto.randomUUID()
      await patchConn({ oauth_state: state })
      const u = new URL('https://authz.constantcontact.com/oauth2/default/v1/authorize')
      u.searchParams.set('client_id', CLIENT_ID)
      u.searchParams.set('redirect_uri', REDIRECT_URI)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('scope', 'contact_data offline_access')
      u.searchParams.set('state', state)
      return json({ url: u.toString() })
    }
    if (action === 'lists') {
      const r = await cc('/contact_lists?limit=1000&include_count=true')
      if (!r.ok) return json({ error: `Constant Contact said ${r.status}` }, 502)
      return json({ lists: (r.body.lists || []).map((l: any) => ({ id: l.list_id, name: l.name, count: l.membership_count ?? null })) })
    }
    if (action === 'save-lists') {
      await patchConn({
        newsletter_list_id: body.newsletter_list_id || null, newsletter_list_name: body.newsletter_list_name || null,
        volunteer_list_id: body.volunteer_list_id || null, volunteer_list_name: body.volunteer_list_name || null,
      })
      return json({ ok: true })
    }
    if (action === 'sync') {
      const rr = await sb(`/rest/v1/nsh_form_responses?id=eq.${encodeURIComponent(body.response_id)}&select=id,form_id,answers`)
      const rows = await rr.json()
      if (!Array.isArray(rows) || !rows[0]) return json({ error: 'Response not found' }, 404)
      const c = await getConn()
      if (!c || !c.refresh_token) { await logSync(rows[0].id, 'sync', '', 'skipped', 'Constant Contact is not connected yet'); return json({ status: 'skipped' }) }
      return json({ status: await addPerson(c, rows[0].form_id, rows[0].id, rows[0].answers) })
    }
    if (action === 'backfill') {
      const formId = body.form === 'volunteer' ? VOLUNTEER_FORM : NEWSLETTER_FORM
      const c = await getConn()
      if (!c || !c.refresh_token) return json({ error: 'Constant Contact is not connected yet' }, 400)
      const rr = await sb(`/rest/v1/nsh_form_responses?form_id=eq.${formId}&select=id,form_id,answers&order=created_at.asc&limit=5000`)
      const rows = await rr.json()
      const counts: Record<string, number> = { added: 0, skipped: 0, failed: 0 }
      for (const row of Array.isArray(rows) ? rows : []) counts[await addPerson(c, row.form_id, row.id, row.answers)]++
      return json(counts)
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
