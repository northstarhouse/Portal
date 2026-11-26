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
// Shown on the website when an event has no photo (served from the Portal's own site).
const PLACEHOLDER_IMAGE = 'https://northstarhouse.github.io/Portal/assets/event-placeholder.png'

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
// **bold**, *italic* and ***both*** inside a line become formatted runs of text.
function inlineNodes(text: string, bold = false) {
  const out: unknown[] = []
  const run = (t: string, b: boolean, i: boolean) => {
    if (!t) return
    const decorations: unknown[] = []
    if (b) decorations.push({ type: 'BOLD', fontWeightValue: 700 })
    if (i) decorations.push({ type: 'ITALIC', italicData: true })
    out.push({ id: '', type: 'TEXT', nodes: [], textData: { text: t, decorations } })
  }
  let last = 0
  const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    run(text.slice(last, m.index), bold, false)
    if (m[1] !== undefined) run(m[1], true, true)
    else if (m[2] !== undefined) run(m[2], true, false)
    else run(m[3], bold, true)
    last = m.index + m[0].length
  }
  run(text.slice(last), bold, false)
  return out
}
const para = (text: string, bold = false) => ({
  id: rid(), type: 'PARAGRAPH',
  nodes: inlineNodes(text, bold),
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
  // Consecutive quoted lines (even with blank lines between them) become one quote block, so its vertical line runs unbroken.
  let quote: unknown[] = []
  let quoteLines: string[] = []
  let quoteGap = false
  const flushQuote = () => {
    if (quoteLines.length) quote.push(para(quoteLines.join('\n')))
    quoteLines = []; quoteGap = false
    if (!quote.length) return
    nodes.push({ id: rid(), type: 'BLOCKQUOTE', nodes: quote, blockquoteData: { indentation: 0 } })
    quote = []
  }
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    // Every quoted line (blank lines between them are ignored) stays in one single-spaced paragraph, one line under the next.
    if (/^>\s*\S/.test(line)) { flush(); quoteLines.push(line.replace(/^>\s*/, '')); continue }
    if (!line && quoteLines.length) continue
    flushQuote()
    // a line of three or more dashes becomes a thin divider line
    if (/^(-{3,}|_{3,})$/.test(line)) { flush(); nodes.push({ id: rid(), type: 'DIVIDER', nodes: [], dividerData: { lineStyle: 'SINGLE', width: 'LARGE', alignment: 'CENTER' } }); continue }
    if (/^[-•*]\s+/.test(line)) { bullets.push(line.replace(/^[-•*]\s+/, '')); continue }
    flush()
    nodes.push(para(line))
  }
  flushQuote()
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

// A save rewrites the ticket types, so re-apply the ticket cap (sold out / most per order) right after it.
async function applyCapacity(slug: string | null | undefined) {
  if (!slug) return
  try { await rest('rpc/sync_ticket_capacity', { method: 'POST', body: JSON.stringify({ p_slug: slug }) }) } catch (_e) { /* the next order re-applies it */ }
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


// Volunteer Hub staff (signed in with their Hub account, Team includes "staff") may also call this, not just a Portal session.
async function hubStaff(req: Request): Promise<string | true> {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
  if (!bearer || bearer === KEY) return 'no sign-in reached the server (hard-refresh the page and sign in again)'
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${bearer}` } })
  if (!u.ok) return `the Volunteer Hub sign-in was not accepted (${u.status}); sign out and back in`
  const email = String((await u.json().catch(() => ({}))).email || '').trim()
  if (!email) return 'the sign-in has no email'
  const r = await fetch(`${URL_}/rest/v1/${encodeURIComponent('2026 Volunteers')}?Email=ilike.${encodeURIComponent(email)}&select=Team&limit=5`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  const rows = await r.json().catch(() => [])
  if (!Array.isArray(rows)) return 'could not look up the volunteer record'
  return rows.some((v) => String(v.Team || '').split(/[|,]/).some((t) => t.trim().toLowerCase() === 'staff')) ? true : `${email} is not marked Staff in the volunteer list`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405)
  try {
    const token = req.headers.get('x-app-token') || ''
    const ok = token ? await rest('rpc/has_valid_app_session', { method: 'POST', headers: { 'x-app-token': token }, body: '{}' }) : false
    if (ok !== true) { const why = await hubStaff(req); if (why !== true) return json({ error: (token ? 'Staff session expired. Sign in again.' : 'Staff sign-in required') + ' (' + why + ')' }, 403) }

    const body = await req.json()
    const action = String(body.action || '')

    if (action === 'list') {
      const rows = await rest('site_events?select=id,slug,title,status,start_at,date_tbd,registration_type,image_url,updated_at&order=start_at.desc.nullsfirst&limit=500')
      return json({ events: rows })
    }

    // One event, shaped like the Portal's edit form (Pacific date/times, description as plain text).
    if (action === 'get') {
      const id = String(body.id || '')
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Event not found.' }, 404)
      const rows = await rest(`site_events?id=eq.${id}&select=*&limit=1`)
      const r = rows?.[0]
      if (!r) return json({ error: 'Event not found.' }, 404)
      const pac = (iso: string | null) => {
        if (!iso) return { date: '', time: '' }
        const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso))
        const g = (k: string) => p.find((x) => x.type === k)?.value || ''
        return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }
      }
      const s = pac(r.start_at), en = pac(r.end_at)
      // deno-lint-ignore no-explicit-any
      const textOf = (n: any): string => (n?.nodes || []).map((c: any) => {
        if (c.type !== 'TEXT') return textOf(c)
        const t = String(c.textData?.text || '')
        const d = (c.textData?.decorations || []) as { type: string }[]
        const b = d.some((x) => x.type === 'BOLD'), i = d.some((x) => x.type === 'ITALIC')
        const core = t.trim()
        if (!core || (!b && !i)) return t
        const mark = b && i ? '***' : b ? '**' : '*'
        return t.slice(0, t.indexOf(core)) + mark + core + mark + t.slice(t.indexOf(core) + core.length)
      }).join('')
      // deno-lint-ignore no-explicit-any
      const lines = ((r.description?.nodes || []) as any[]).flatMap((n) => n.type === 'DIVIDER' ? ['---'] : n.type === 'BLOCKQUOTE' ? [(n.nodes || []).map((p: any) => textOf(p).split('\n').map((l: string) => '> ' + l).join('\n')).join('\n\n')] : n.type === 'BULLETED_LIST' || n.type === 'ORDERED_LIST'
        // deno-lint-ignore no-explicit-any
        ? (n.nodes || []).map((li: any) => '- ' + textOf(li)) : [textOf(n)])
      const isPlaceholder = String(r.image_url || '') === PLACEHOLDER_IMAGE
      return json({ event: {
        id: r.id, slug: r.slug, title: r.title, status: r.status,
        short_description: r.short_description || '', description: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        image_url: isPlaceholder ? '' : (r.image_url || ''), image_alt: isPlaceholder ? '' : (r.image_alt || ''),
        date: s.date, start_time: s.time || '18:00', end_time: en.time, date_tbd: !!r.date_tbd,
        location_name: r.location_name || '', location_address: r.location_address || '',
        registration_type: r.registration_type === 'TICKETING' ? 'TICKETING' : r.registration_type === 'RSVP' ? 'RSVP' : 'NONE',
        // deno-lint-ignore no-explicit-any
        ticket_tiers: (Array.isArray(r.ticket_tiers) && r.ticket_tiers.length ? r.ticket_tiers : [{ name: 'General Admission', price: '', limit: '' }]).map((t: any) => ({ name: t.name || '', price: t.price != null ? String(t.price) : '', limit: t.limitPerCheckout != null ? String(t.limitPerCheckout) : '' })),
        ticket_limit_per_order: String(r.ticket_limit_per_order || 20),
        ticket_capacity: r.ticket_capacity != null ? String(r.ticket_capacity) : '',
        featured_frame: r.featured_frame || null,
      } })
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

      // 'RSVP' = free event with the website's own RSVP form (calendar button shows the RSVP button, no tickets)
      const regType = e.registration_type === 'TICKETING' ? 'TICKETING' : e.registration_type === 'RSVP' ? 'RSVP' : 'NONE'
      const tierList = regType === 'TICKETING' ? tiers(e.ticket_tiers) : []
      if (regType === 'TICKETING' && !tierList.length) return json({ error: 'Add at least one ticket type with a name and price.' }, 400)

      // The web address (last part of the event's link): chosen by the team, or made from the title.
      const wantedSlug = slugify(String(e.slug || ''))
      if (String(e.slug || '').trim() && !wantedSlug) return json({ error: 'The web address can only use letters, numbers and dashes.' }, 400)
      const startAt = dateTbd ? null : pacificToUtc(e.date, e.start_time || '18:00')
      const endAt = dateTbd || !e.end_time ? null : pacificToUtc(e.date, e.end_time)
      if (!dateTbd && !startAt) return json({ error: 'The date or start time is not valid.' }, 400)

      const row: Record<string, unknown> = {
        title, status,
        short_description: String(e.short_description || '').trim().slice(0, 300),
        description: toDocument(String(e.description || '')),
        image_url: String(e.image_url || '').trim() || PLACEHOLDER_IMAGE,
        image_alt: String(e.image_url || '').trim() ? String(e.image_alt || title).trim().slice(0, 200) : 'More information to come',
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
      // Total tickets available. Only touched when the form sends it (the Events Committee push leaves the cap alone).
      if ('ticket_capacity' in e) {
        const cap = Math.round(Number(e.ticket_capacity))
        row.ticket_capacity = cap > 0 ? Math.min(cap, 100000) : null
        if (row.ticket_capacity === null) row.sold_out = false
      }
      // Homepage "Featured event" box: how much of a too-long flyer shows ({keep, focusY, ratio}; null = whole flyer).
      // Only touched when the form sends it, so other callers (Events Committee push) leave it alone.
      if ('featured_frame' in e) {
        const f = e.featured_frame
        const keep = Number(f?.keep), ratio = Number(f?.ratio)
        row.featured_frame = String(e.image_url || '').trim() && f && keep > 0 && keep < 1 && ratio > 0 && ratio < 10
          ? { keep: Math.max(0.4, keep), focusY: Math.max(0, Math.min(100, Number(f.focusY) || 0)), ratio }
          : null
      }

      const id = String(e.id || '')
      if (id) {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Event not found.' }, 404)
        if (wantedSlug) {
          const clash = await rest(`site_events?select=id&slug=eq.${encodeURIComponent(wantedSlug)}&id=neq.${id}&limit=1`)
          if (clash.length) return json({ error: 'That web address is already used by another event. Choose a different one.' }, 409)
          row.slug = wantedSlug
        }
        // A partial update (the Events Committee "Push to website") leaves the photo and short description alone unless it sends them.
        if (e.partial === true) {
          if (!String(e.image_url || '').trim()) { delete row.image_url; delete row.image_alt }
          if (!String(e.short_description || '').trim()) { delete row.short_description; delete row.seo_description }
          if (e.ticket_limit_per_order == null) delete row.ticket_limit_per_order
        }
        const saved = await rest(`site_events?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(row) })
        if (!saved?.[0]) return json({ error: 'Event not found.' }, 404)
        await applyCapacity(saved[0].slug)
        return json({ event: saved[0], refreshed: await refreshSite() })
      }

      // New event: a web address from the title (and year), made unique.
      const year = startAt ? new Date(startAt).getUTCFullYear() : ''
      const base = wantedSlug || slugify(title + (year ? ' ' + year : '')) || 'event'
      let slug = base
      if (wantedSlug) {
        const clash = await rest(`site_events?select=id&slug=eq.${encodeURIComponent(wantedSlug)}&limit=1`)
        if (clash.length) return json({ error: 'That web address is already used by another event. Choose a different one.' }, 409)
      }
      for (let n = 2; !wantedSlug && n < 50; n++) {
        const clash = await rest(`site_events?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`)
        if (!clash.length) break
        slug = `${base}-${n}`
      }
      const top = await rest('site_events?select=sort_index&order=sort_index.desc&limit=1')
      const saved = await rest('site_events', { method: 'POST', body: JSON.stringify({ ...row, slug, sort_index: (top?.[0]?.sort_index ?? 0) + 1 }) })
      await applyCapacity(saved[0]?.slug)
      return json({ event: saved[0], refreshed: await refreshSite() })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500)
  }
})
