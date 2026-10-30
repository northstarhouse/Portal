// Journal (blog) editing for the Portal. The posts live in public.site_posts (read live by the website worker);
// writes need the service key, so the Portal goes through this function. Only a signed-in Portal session may call it.
//
// POST body: { action: 'list' | 'get' | 'save' | 'delete', ... }
//   list                        -> posts without their bodies, newest first
//   get    { id }               -> one full post
//   save   { post: {...} }      -> create (no id) or update; returns the saved row
//   delete { id }
// After any change that can affect the live site the website is told to refresh its post cache. That needs the
// CONTENT_REFRESH_SECRET secret (same value the website worker uses); without it the site picks the change up on
// its own schedule.

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`)
  return data
}

function slugify(s: string) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}
function htmlToText(html: string) {
  return String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

// The live site keeps a copy of the posts; tell it to re-read them.
async function refreshSite() {
  const secret = Deno.env.get('CONTENT_REFRESH_SECRET')
  if (!secret) return false
  try {
    const r = await fetch('https://www.northstarhouse.org/api/_internal/refresh-content', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-refresh-secret': secret },
      body: JSON.stringify({ what: 'posts' }),
    })
    return r.ok
  } catch {
    return false
  }
}

const WRITABLE = ['title', 'slug', 'status', 'excerpt', 'body_html', 'body_text', 'hero_image_url', 'hero_image_alt', 'category', 'categories', 'author_name',
  'featured', 'seo_title', 'seo_description', 'og_image_url', 'canonical_url', 'focus_keyword', 'min_read', 'published_at', 'scheduled_for', 'hide_hero_banner']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405)
  try {
    const token = req.headers.get('x-app-token') || ''
    if (!token) return json({ error: 'Staff sign-in required.' }, 403)
    const ok = await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': token }, body: '{}' })
    if (ok !== true) return json({ error: 'Staff session expired. Sign in again.' }, 403)

    const body = await req.json()
    const action = String(body.action || '')

    if (action === 'list') {
      const rows = await rest('site_posts?select=id,slug,title,status,excerpt,hero_image_url,category,author_name,published_at,scheduled_for,updated_at,created_at&order=updated_at.desc&limit=1000')
      return json({ posts: rows })
    }

    if (action === 'get') {
      const rows = await rest(`site_posts?select=*&id=eq.${encodeURIComponent(String(body.id || ''))}`)
      if (!rows?.[0]) return json({ error: 'Post not found.' }, 404)
      return json({ post: rows[0] })
    }

    if (action === 'delete') {
      const id = encodeURIComponent(String(body.id || ''))
      await rest(`site_posts?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      return json({ deleted: true, refreshed: await refreshSite() })
    }

    if (action === 'save') {
      const p = body.post || {}
      const title = String(p.title || '').trim()
      if (!title) return json({ error: 'A post needs a title.' }, 400)
      const status = ['draft', 'scheduled', 'published'].includes(p.status) ? p.status : 'draft'
      const bodyHtml = String(p.body_html || '')
      const text = htmlToText(bodyHtml)

      // Only write columns this table actually has.
      const probe = await rest('site_posts?select=*&limit=1')
      const have = new Set(Object.keys(probe?.[0] || {}))
      if (!have.size) WRITABLE.forEach((c) => have.add(c))

      let slug = slugify(p.slug || title) || 'post'
      const dupes = await rest(`site_posts?select=id&slug=eq.${encodeURIComponent(slug)}`)
      if (dupes.some((d: { id: string }) => d.id !== p.id)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

      let publishedAt = p.published_at || null
      if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString()
      if (status === 'scheduled') {
        if (!p.scheduled_for) return json({ error: 'Pick a date and time to schedule this post.' }, 400)
        publishedAt = p.scheduled_for
      }
      if (status === 'draft') publishedAt = p.published_at || null

      const row: Record<string, unknown> = {
        ...p,
        title, slug, status,
        body_html: bodyHtml,
        body_text: text,
        min_read: Math.max(1, Math.round((text.match(/\S+/g) || []).length / 225)),
        published_at: publishedAt,
        scheduled_for: status === 'scheduled' ? p.scheduled_for : null,
      }
      if (Array.isArray(p.categories) && p.categories.length) row.category = p.categories[0]
      const payload: Record<string, unknown> = {}
      for (const c of WRITABLE) if (c in row && have.has(c)) payload[c] = row[c]
      // The Portal editor stores HTML only; drop any older editor document so the two can never disagree.
      if (have.has('body_json')) payload.body_json = null

      let saved
      if (p.id) {
        saved = (await rest(`site_posts?id=eq.${encodeURIComponent(p.id)}`, { method: 'PATCH', body: JSON.stringify(payload) }))?.[0]
        if (!saved) return json({ error: 'Post not found.' }, 404)
      } else {
        saved = (await rest('site_posts', { method: 'POST', body: JSON.stringify(payload) }))?.[0]
      }
      try {
        await rest('site_post_revisions', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ post_id: saved.id, snapshot: { title, slug, status, excerpt: payload.excerpt ?? '', bodyHtml, seo: { title: payload.seo_title ?? '', description: payload.seo_description ?? '' } }, label: status, word_count: (text.match(/\S+/g) || []).length }),
        })
      } catch { /* history is a bonus */ }
      return json({ post: saved, refreshed: await refreshSite() })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Something went wrong.' }, 500)
  }
})
