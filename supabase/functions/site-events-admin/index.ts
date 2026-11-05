// Website events for the Portal (Admin > New Event). Events live in public.site_events, which the website reads live
// (only rows with status 'published' are public). Writes need the service key, so the Portal goes through this function.
// Only a signed-in Portal session may call it.
//
// POST body: { action: 'list' | 'save' | 'delete', ... }
//   list                      -> events, soonest first
//   save   { event: {...} }   -> create (no id) or update; returns the saved row
//   delete { id }
// The Portal sends plain fields (title, description text, date and times in Pacific time, ticket tiers as name + price);
// this function turns them into the shapes the website expects (rich-text description, UTC times, full ticket tiers).

const URL_ = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const TZ = 'America/Los_Angeles'

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

// Local Pacific date ('YYYY-MM-DD') and time ('HH:MM') -> ISO UTC. Handles daylight saving by checking what Pacific time the guess lands on.
function pacificToUtc(date: string, time: string): string | null {
  const d = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const t = String(time || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!d || !t) return null
  const want = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  let guess = want
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess))
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value)
    const shown = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'))
    if (shown === want) break
    guess += want - shown
  }
  return new Date(guess).toISOString()
}

const rid = () => Math.random().toString(36).slice(2, 10)
const para = (text: string, bold = false) => ({
  id: rid(), type: 'PARAGRAPH',
  nodes: text ? [{ id: '', type: 'TEXT', nodes: [], textData: { text, decorations: bold ? [{ type: 'BOLD', fontWeightValue: 700 }] : [] } }] : [],
  paragraphData: { textStyle: { textAlignment: 'AUTO' } },
})
// Plain text -> the website's rich-text document. A blank line starts a new paragraph; lines starting "- " become a bulleted list.
function toDocument(text: string) {
  const nodes: unknown[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    nodes.push({ id: rid(), type: 'BULLETED_LIST', nodes: bullets.map((b) => ({ id: rid(), type: 'LIST_ITEM', nodes: [para(b)] })), bulletedListData: { indentation: 0 } })
    bullets = []
  }
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (/^[-•*]\s+/.test(line)) { bullets.push(line.replace(/^[-•*]\s+/, '')); continue }
    flush()
    nodes.push(para(line))
  }
  flush()
  while (nodes.length && !(nodes[nodes.length - 1] as { nodes: unknown[] }).nodes.length) nodes.pop()
  return { nodes, documentStyle: {} }
}

// deno-lint-ignore no-explicit-any
function tiers(list: any[]) {
  return (Array.isArray(list) ? list : []).filter((t) => t && String(t.name || '').trim()).slice(0, 12).map((t) => {
    const price = Math.max(0, Math.round(Number(t.price) * 100) / 100 || 0)
    const limit = Math.round(Number(t.limit)) || 50
    return { id: crypto.randomUUID(), free: price === 0, name: String(t.name).trim().slice(0, 80), note: '', addon: false, price, hidden: false, onSale: true, soldOut: false, currency: 'USD', description: String(t.description || '').slice(0, 300), limitPerCheckout: Math.min(Math.max(limit, 1), 100) }
  })
}

// The live site keeps copies of its content; ask it to re-read events. Best effort: without the secret it picks changes up on its own.
async function refreshSite() {
  const secret = Deno.env.get('CONTENT_REFRESH_SECRET')
  if (!secret) return false
  try {
    const r = await fetch('https://www.northstarhouse.org/api/_internal/refresh-content', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-refresh-secret': secret }, body: JSON.stringify({ what: 'events' }),
    })
    return r.ok
  } catch { return false }
}

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
      const rows = await rest('site_events?select=id,slug,title,status,start_at,date_tbd,registration_type,image_url,updated_at&order=start_at.desc.nullsfirst&limit=500')
      return json({ events: rows })
    }

    if (action === 'delete') {
      const id = String(body.id || '')
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Event not found.' }, 404)
      await rest(`site_events?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      return json({ deleted: true, refreshed: await refreshSite() })
    }

    if (action === 'save') {
      const e = body.event || {}
      const title = String(e.title || '').trim().slice(0, 140)
      if (!title) return json({ error: 'Give the event a title.' }, 400)
      const status = e.status === 'published' ? 'published' : 'draft'
      const dateTbd = e.date_tbd === true
      if (status === 'published' && !dateTbd && !/^\d{4}-\d{2}-\d{2}$/.test(String(e.date || ''))) return json({ error: 'Choose the event date, or mark it "date to be announced".' }, 400)

      const regType = e.registration_type === 'TICKETING' ? 'TICKETING' : 'NONE'
      const tierList = regType === 'TICKETING' ? tiers(e.ticket_tiers) : []
      if (regType === 'TICKETING' && !tierList.length) return json({ error: 'Add at least one ticket type with a name and price.' }, 400)

      const startAt = dateTbd ? null : pacificToUtc(e.date, e.start_time || '18:00')
      const endAt = dateTbd || !e.end_time ? null : pacificToUtc(e.date, e.end_time)
      if (!dateTbd && !startAt) return json({ error: 'The date or start time is not valid.' }, 400)

      const row: Record<string, unknown> = {
        title, status,
        short_description: String(e.short_description || '').trim().slice(0, 300),
        description: toDocument(String(e.description || '')),
        image_url: String(e.image_url || '').trim(),
        image_alt: String(e.image_alt || title).trim().slice(0, 200),
        start_at: startAt, end_at: endAt, hide_end: !endAt, date_tbd: dateTbd, time_zone: TZ,
        location_name: String(e.location_name || 'North Star House').trim().slice(0, 120),
        location_address: String(e.location_address || '12075 Auburn Rd, Grass Valley, CA 95949, USA').trim().slice(0, 200),
        location_tbd: false,
        registration_type: regType, ticket_tiers: tierList,
        ticket_limit_per_order: Math.min(Math.max(Math.round(Number(e.ticket_limit_per_order)) || 20, 1), 100),
        currency: 'USD',
        seo_description: String(e.short_description || '').trim().slice(0, 300),
        updated_at: new Date().toISOString(),
      }

      const id = String(e.id || '')
      if (id) {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Event not found.' }, 404)
        const saved = await rest(`site_events?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(row) })
        if (!saved?.[0]) return json({ error: 'Event not found.' }, 404)
        return json({ event: saved[0], refreshed: await refreshSite() })
      }

      // New event: a web address from the title (and year), made unique.
      const year = startAt ? new Date(startAt).getUTCFullYear() : ''
      const base = slugify(title + (year ? ' ' + year : '')) || 'event'
      let slug = base
      for (let n = 2; n < 50; n++) {
        const clash = await rest(`site_events?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`)
        if (!clash.length) break
        slug = `${base}-${n}`
      }
      const top = await rest('site_events?select=sort_index&order=sort_index.desc&limit=1')
      const saved = await rest('site_events', { method: 'POST', body: JSON.stringify({ ...row, slug, sort_index: (top?.[0]?.sort_index ?? 0) + 1 }) })
      return json({ event: saved[0], refreshed: await refreshSite() })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500)
  }
})
