// Website media library for the Portal. Photos live in Cloudflare Images, which resizes them on delivery
// (the website asks for the width it needs), so one upload serves every screen size.
// Only a signed-in Portal session may call this.
//
// POST JSON:       { action: 'list', page?: number }  |  { action: 'delete', id }
// POST multipart:  action=upload, file=<image>, [name=<display name>]
// Needs the CF_IMAGES_TOKEN secret (Cloudflare: Account > Cloudflare Images > Edit).

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN = Deno.env.get('CF_IMAGES_TOKEN')
const ACCOUNT = 'eb566471d9849f7d4d82a076726f0eea'
const HASH = 'Rrohk4_BCOw-Pt2qc0eZDQ'
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/images/v1`
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const deliver = (id: string, variant = 'public') => `https://imagedelivery.net/${HASH}/${id}/${variant}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405)
  try {
    const token = req.headers.get('x-app-token') || ''
    if (!token) return json({ error: 'Staff sign-in required.' }, 403)
    const ok = await fetch(`${URL_}/rest/v1/rpc/has_valid_app_session`, {
      method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'x-app-token': token }, body: '{}',
    }).then((r) => r.json())
    if (ok !== true) return json({ error: 'Staff session expired. Sign in again.' }, 403)
    if (!TOKEN) return json({ error: 'Photo storage is not connected yet (CF_IMAGES_TOKEN is not set).' }, 503)
    const auth = { Authorization: `Bearer ${TOKEN}` }

    const type = req.headers.get('content-type') || ''
    if (type.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return json({ error: 'No photo received.' }, 400)
      if (file.size > 10 * 1024 * 1024) return json({ error: 'That photo is over 10 MB. Try a smaller one.' }, 413)
      const up = new FormData()
      up.set('file', file, String(form.get('name') || file.name || 'photo.jpg'))
      up.set('metadata', JSON.stringify({ source: 'portal', name: String(form.get('name') || file.name || '') }))
      up.set('requireSignedURLs', 'false')
      const r = await fetch(API, { method: 'POST', headers: auth, body: up })
      const j = await r.json().catch(() => ({}))
      if (!j.success) return json({ error: 'Upload failed: ' + ((j.errors && j.errors[0] && j.errors[0].message) || r.status) }, 502)
      return json({ image: { id: j.result.id, name: j.result.filename, uploaded: j.result.uploaded, url: deliver(j.result.id) } })
    }

    const body = await req.json()
    if (body.action === 'list') {
      const page = Math.max(1, Number(body.page) || 1)
      const r = await fetch(`${API}?page=${page}&per_page=100`, { headers: auth })
      const j = await r.json().catch(() => ({}))
      if (!j.success) return json({ error: 'Could not load photos.' }, 502)
      const images = (j.result.images || []).map((i: { id: string; filename: string; uploaded: string; meta?: { name?: string } }) => ({
        id: i.id, name: (i.meta && i.meta.name) || i.filename || i.id, uploaded: i.uploaded, url: deliver(i.id), thumb: deliver(i.id, 'w=320,fit=scale-down,q=70'),
      }))
      return json({ images, page, more: images.length === 100 })
    }
    if (body.action === 'delete') {
      const id = String(body.id || '')
      if (!id) return json({ error: 'No photo chosen.' }, 400)
      const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth })
      const j = await r.json().catch(() => ({}))
      if (!j.success) return json({ error: 'Could not delete that photo.' }, 502)
      return json({ deleted: true })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Something went wrong.' }, 500)
  }
})
