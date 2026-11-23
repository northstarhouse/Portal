// Where Constant Contact sends the person after they click Allow:
//   https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/constant-contact-callback
// Checks the one-time state, trades the code for tokens, stores them (server only), and shows a "Connected" page.
// Deploy with --no-verify-jwt: Constant Contact's redirect carries no Supabase key.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('CC_CLIENT_ID') || 'e97238cc-4a50-4af1-bb40-1181d2431717'
const CLIENT_SECRET = Deno.env.get('CC_CLIENT_SECRET') || ''
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/constant-contact-callback`
const PORTAL = 'https://northstarhouse.github.io/Portal/'

// Supabase serves HTML from functions as plain text, so send the person back to the Portal instead; the Constant Contact page there shows the result.
const page = (title: string, message: string, ok: boolean) => new Response(null, {
  status: 302,
  headers: { Location: PORTAL + (ok ? '?cc=connected' : '?cc_error=' + encodeURIComponent(title + ': ' + message)) + '#constant-contact' },
})

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (err) return page('Not connected', 'Constant Contact said: ' + err.replace(/[<>]/g, ''), false)
  if (!code || !state) return page('Nothing to do', 'This address is only used by Constant Contact after you click Allow. Start from Admin, Constant Contact in the Portal.', false)
  try {
    const cr = await sb('/rest/v1/cc_connection?id=eq.1&select=oauth_state')
    const rows = await cr.json()
    if (!Array.isArray(rows) || !rows[0] || rows[0].oauth_state !== state) return page('Link expired', 'That connection link is no longer valid. Go back to the Portal and click Connect again.', false)
    const t = await fetch('https://authz.constantcontact.com/oauth2/default/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`) },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }).toString(),
    })
    const j = await t.json().catch(() => ({}))
    if (!t.ok) return page('Not connected', 'Constant Contact would not accept the connection (' + String(j.error_description || j.error || t.status).replace(/[<>]/g, '') + ').', false)
    await sb('/rest/v1/cc_connection?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({
        access_token: j.access_token, refresh_token: j.refresh_token || null,
        expires_at: new Date(Date.now() + (j.expires_in || 7200) * 1000).toISOString(),
        oauth_state: null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    })
    return page('Connected', 'Constant Contact is now connected to the Portal. Go back to choose which lists new sign-ups should join.', true)
  } catch (e) {
    return page('Something went wrong', String((e as Error).message).replace(/[<>]/g, ''), false)
  }
})
