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
// deno-lint-ignore no-explicit-any
const shape = (i: any) => ({ id: i.id, name: i.meta?.name || i.filename || i.id, folder: i.meta?.folder || '', alt: i.meta?.alt || '', width: i.meta?.width || null, height: i.meta?.height || null, uploaded: i.uploaded, url: deliver(i.id), thumb: deliver(i.id, 'w=480,h=480,fit=scale-down,q=70') })

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
      up.set('metadata', JSON.stringify({ source: 'portal', folder: String(form.get('folder') || ''), name: String(form.get('name') || file.name || ''), alt: String(form.get('alt') || ''), width: Number(form.get('width')) || null, height: Number(form.get('height')) || null, bytes: file.size }))
      up.set('requireSignedURLs', 'false')
      const r = await fetch(API, { method: 'POST', headers: auth, body: up })
      const j = await r.json().catch(() => ({}))
      if (!j.success) return json({ error: 'Upload failed: ' + ((j.errors && j.errors[0] && j.errors[0].message) || r.status) }, 502)
      return json({ image: shape(j.result) })
    }

    const body = await req.json()
    if (body.action === 'list') {
      // Same listing the website console uses: every image, newest first. Folders are a path kept in each photo's metadata.
      const images: unknown[] = []
      let cont = ''
      do {
        const q = new URLSearchParams({ per_page: '1000', sort_order: 'desc' })
        if (cont) q.set('continuation_token', cont)
        const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/images/v2?${q}`, { headers: auth })
        const j = await r.json().catch(() => ({}))
        if (!j.success) return json({ error: 'Could not load photos.' }, 502)
        images.push(...(j.result.images || []).map(shape))
        cont = j.result.continuation_token || ''
      } while (cont && images.length < 10000)
      return json({ images })
    }
    if (body.action === 'update') {
      const id = String(body.id || '')
      if (!id) return json({ error: 'No photo chosen.' }, 400)
      const cur = await fetch(`${API}/${encodeURIComponent(id)}`, { headers: auth }).then((r) => r.json())
      if (!cur.success) return json({ error: 'Photo not found.' }, 404)
      const meta = { ...(cur.result.meta || {}) } as Record<string, unknown>
      if (typeof body.name === 'string') meta.name = body.name
      if (typeof body.alt === 'string') meta.alt = body.alt
      if (typeof body.folder === 'string') meta.folder = body.folder.split('/').map((x: string) => x.trim()).filter(Boolean).join('/')
      const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ metadata: meta }) })
      const j = await r.json().catch(() => ({}))
      if (!j.success) return json({ error: 'Could not save that change.' }, 502)
      return json({ image: shape(j.result) })
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
