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
    return { email: clean(a.email).toLowerCase(), first: clean(a.first_name || a.name).split(/\s+/)[0] || '', last: '', phone: '', source: 'Newsletter Sign Up', listKey: 'newsletter_lists' }
  }
  return { email: clean(a.v_email).toLowerCase(), first: clean(a.v_first), last: clean(a.v_last), phone: clean(a.v_phone), source: 'Volunteer Sign Up', listKey: 'volunteer_lists' }
}

async function addPerson(conn: any, formId: string, responseId: string | null, answers: Record<string, unknown>) {
  const p = personFrom(formId, answers || {})
  if (!p.email || !/^\S+@\S+\.\S+$/.test(p.email)) { await logSync(responseId, p.source, p.email, 'skipped', 'No valid email address'); return 'skipped' }
  const chosen: { id: string; name: string }[] = Array.isArray(conn[p.listKey]) ? conn[p.listKey] : []
  if (!chosen.length) { await logSync(responseId, p.source, p.email, 'skipped', 'No Constant Contact list chosen for this form yet'); return 'skipped' }
  return await upsertContact(p, chosen, responseId)
}

type Person = { email: string; first: string; last: string; phone: string; source: string }
// Adds the person as Subscribed on the chosen lists, or updates them if they are already in Constant Contact.
async function upsertContact(p: Person, chosen: { id: string; name: string }[], responseId: string | null) {
  const ids = chosen.map((l) => l.id)
  const listNames = chosen.map((l) => l.name).join(' + ')
  // Is this person already in Constant Contact?
  const found = await cc('/contacts?email=' + encodeURIComponent(p.email) + '&status=all&include=list_memberships,phone_numbers,street_addresses,custom_fields')
  if (!found.ok) { await logSync(responseId, p.source, p.email, 'failed', 'Could not look up the contact: Constant Contact said ' + found.status); return 'failed' }
  const existing = found.body && Array.isArray(found.body.contacts) ? found.body.contacts[0] : null

  if (!existing) {
    // New person: created as Subscribed (explicit permission), since they signed up themselves.
    const body: Record<string, unknown> = { email_address: { address: p.email, permission_to_send: 'explicit' }, list_memberships: ids, create_source: 'Account' }
    if (p.first) body.first_name = p.first
    if (p.last) body.last_name = p.last
    if (p.phone) body.phone_numbers = [{ phone_number: p.phone, kind: 'other' }]
    const r = await cc('/contacts', { method: 'POST', body: JSON.stringify(body) })
    if (r.ok) { await logSync(responseId, p.source, p.email, 'added', 'Added as Subscribed to ' + listNames); return 'added' }
    await logSync(responseId, p.source, p.email, 'failed', 'Constant Contact said ' + r.status + ': ' + (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)))
    return 'failed'
  }

  // Already there: never re-subscribe someone who unsubscribed.
  const perm = existing.email_address && existing.email_address.permission_to_send
  if (perm === 'unsubscribed') { await logSync(responseId, p.source, p.email, 'skipped', 'Unsubscribed in Constant Contact, left as is'); return 'skipped' }
  const memberships = Array.from(new Set([...(existing.list_memberships || []), ...ids]))
  const body: Record<string, unknown> = {
    email_address: { address: p.email, permission_to_send: 'explicit' },
    first_name: existing.first_name || p.first || undefined,
    last_name: existing.last_name || p.last || undefined,
    job_title: existing.job_title || undefined,
    company_name: existing.company_name || undefined,
    list_memberships: memberships,
    update_source: 'Account',
  }
  if (Array.isArray(existing.phone_numbers) && existing.phone_numbers.length) body.phone_numbers = existing.phone_numbers.map((x: any) => ({ phone_number: x.phone_number, kind: x.kind || 'other' }))
  else if (p.phone) body.phone_numbers = [{ phone_number: p.phone, kind: 'other' }]
  if (Array.isArray(existing.street_addresses) && existing.street_addresses.length) body.street_addresses = existing.street_addresses.map((x: any) => ({ kind: x.kind, street: x.street, city: x.city, state: x.state, postal_code: x.postal_code, country: x.country }))
  if (Array.isArray(existing.custom_fields) && existing.custom_fields.length) body.custom_fields = existing.custom_fields.map((x: any) => ({ custom_field_id: x.custom_field_id, value: x.value }))
  const r = await cc('/contacts/' + existing.contact_id, { method: 'PUT', body: JSON.stringify(body) })
  if (r.ok) { await logSync(responseId, p.source, p.email, 'added', 'Updated, Subscribed, on ' + listNames); return 'added' }
  await logSync(responseId, p.source, p.email, 'failed', 'Constant Contact said ' + r.status + ': ' + (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)))
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
        newsletter_lists: c?.newsletter_lists || [],
        volunteer_lists: c?.volunteer_lists || [],
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
        newsletter_lists: Array.isArray(body.newsletter_lists) ? body.newsletter_lists : [],
        volunteer_lists: Array.isArray(body.volunteer_lists) ? body.volunteer_lists : [],
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
    if (action === 'import') {
      // A pasted list: { people: [{ email, first, last }], lists: [{ id, name }] }. The Portal sends small batches.
      const c = await getConn()
      if (!c || !c.refresh_token) return json({ error: 'Constant Contact is not connected yet' }, 400)
      const lists = Array.isArray(body.lists) ? body.lists.filter((l: any) => l && l.id) : []
      if (!lists.length) return json({ error: 'Choose at least one list' }, 400)
      const people = Array.isArray(body.people) ? body.people.slice(0, 40) : []
      const out: { email: string; status: string; detail: string }[] = []
      for (const x of people) {
        const email = clean(x.email).toLowerCase()
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) { out.push({ email, status: 'skipped', detail: 'Not a valid email address' }); continue }
        const before = await sb('/rest/v1/cc_sync_log?select=id&order=id.desc&limit=1')
        const lastId = ((await before.json()) as any[])[0]?.id || 0
        const status = await upsertContact({ email, first: clean(x.first), last: clean(x.last), phone: '', source: clean(body.source) || 'Pasted list' }, lists, null)
        const after = await sb('/rest/v1/cc_sync_log?select=detail&id=gt.' + lastId + '&order=id.desc&limit=1')
        const detail = ((await after.json()) as any[])[0]?.detail || ''
        out.push({ email, status, detail })
        await new Promise((r) => setTimeout(r, 450)) // Constant Contact allows about 4 calls per second
      }
      return json({ results: out })
    }
    if (action === 'remove-contact') {
      // A donor was marked deceased: take them off every Constant Contact list (their contact record stays, nothing is deleted).
      const email = clean(body.email).toLowerCase()
      if (!email) return json({ status: 'skipped' })
      const c = await getConn()
      if (!c || !c.refresh_token) { await logSync(null, 'Marked deceased', email, 'skipped', 'Constant Contact is not connected'); return json({ status: 'skipped' }) }
      const found = await cc('/contacts?email=' + encodeURIComponent(email) + '&status=all&include=list_memberships,phone_numbers,street_addresses,custom_fields')
      const existing = found.ok && found.body && Array.isArray(found.body.contacts) ? found.body.contacts[0] : null
      if (!existing) { await logSync(null, 'Marked deceased', email, 'skipped', 'Not in Constant Contact'); return json({ status: 'not-found' }) }
      if (!(existing.list_memberships || []).length) { await logSync(null, 'Marked deceased', email, 'skipped', 'Already on no lists'); return json({ status: 'already' }) }
      const upd: Record<string, unknown> = {
        email_address: { address: email, permission_to_send: (existing.email_address && existing.email_address.permission_to_send) || 'explicit' },
        first_name: existing.first_name || undefined, last_name: existing.last_name || undefined,
        job_title: existing.job_title || undefined, company_name: existing.company_name || undefined,
        list_memberships: [], update_source: 'Account',
      }
      if (Array.isArray(existing.phone_numbers) && existing.phone_numbers.length) upd.phone_numbers = existing.phone_numbers.map((x: any) => ({ phone_number: x.phone_number, kind: x.kind || 'other' }))
      if (Array.isArray(existing.street_addresses) && existing.street_addresses.length) upd.street_addresses = existing.street_addresses.map((x: any) => ({ kind: x.kind, street: x.street, city: x.city, state: x.state, postal_code: x.postal_code, country: x.country }))
      if (Array.isArray(existing.custom_fields) && existing.custom_fields.length) upd.custom_fields = existing.custom_fields.map((x: any) => ({ custom_field_id: x.custom_field_id, value: x.value }))
      const r = await cc('/contacts/' + existing.contact_id, { method: 'PUT', body: JSON.stringify(upd) })
      await logSync(null, 'Marked deceased', email, r.ok ? 'removed' : 'failed', r.ok ? 'Removed from all Constant Contact lists' : 'Constant Contact said ' + r.status)
      return json({ status: r.ok ? 'removed' : 'failed' })
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
