// Deletes one estate_tours row. Exists because estate_tours' RLS allows the
// publishable/anon key to INSERT and UPDATE (needed for the public site's
// own booking flow) but not DELETE -- confirmed live: an anon-key DELETE
// against a real row returns 204 with the row still present. Staff-side
// deletes (clearing test bookings, cancelling a booking outright) go
// through this function instead, using the service role key.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
    const { id } = await req.json()
    if (!id || typeof id !== 'string') return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

    const res = await fetch(`${SUPABASE_URL}/rest/v1/estate_tours?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
    })
    const deleted = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: deleted }), { status: 500 })
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return new Response(JSON.stringify({ error: 'No row with that id' }), { status: 404 })
    }
    return new Response(JSON.stringify({ ok: true, deleted: deleted[0] }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
