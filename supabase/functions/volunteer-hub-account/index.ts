// Ensures a volunteer has a working Volunteer Hub (Supabase Auth) login and
// resets it to a fresh temporary password -- so the Portal's "Update Info
// Reminder" email can always hand someone working credentials, whether
// they've never logged in before or forgot their password. Uses the GoTrue
// Admin API directly via raw fetch (service role key), same pattern as
// every other function in this project -- no supabase-js client.
//
// POST body: { volunteer_id: number, email: string }
// Response:  { success: true, tempPassword: string } | { success: false, error: string }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Fixed by request rather than randomly generated -- every reset/creation
// hands out this same temporary password. Fine since must_change_password
// forces a real password to be set on first login regardless.
const TEMP_PASSWORD = 'JuliaMorgan1905';

async function setPassword(authUserId: string, tempPassword: string, email?: string) {
  const body: Record<string, unknown> = { password: tempPassword, user_metadata: { must_change_password: true } };
  if (email) body.email = email;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update auth user: ${res.status} ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ success: false, error: 'Unsupported method' }, 405);

  try {
    const { volunteer_id, email } = await req.json();
    if (!volunteer_id || !email) return json({ success: false, error: 'volunteer_id and email are required' }, 400);

    const tempPassword = TEMP_PASSWORD;

    // Already linked to a known auth user for this volunteer?
    const linkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/volunteer_auth_links?volunteer_id=eq.${volunteer_id}&select=auth_user_id`,
      { headers: adminHeaders },
    );
    const links = await linkRes.json();
    const linkedAuthId = Array.isArray(links) && links[0] ? links[0].auth_user_id : null;

    if (linkedAuthId) {
      await setPassword(linkedAuthId, tempPassword, email);
      return json({ success: true, tempPassword });
    }

    // No link yet. IMPORTANT: GoTrue's admin "list users" endpoint does NOT
    // support filtering by email via a query param -- an earlier version of
    // this function tried `?email=` here, which was silently ignored and
    // returned the default (unfiltered) user list, so `users[0]` was some
    // unrelated real account. That bug reset a real person's password and
    // mis-linked their account before it was caught. Do not reintroduce an
    // email-filtered list call here. createUser itself will fail with a
    // clear "already registered" error if this email already has an
    // account -- that's the correct, safe way to detect it.
    const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email, password: tempPassword, email_confirm: true, user_metadata: { must_change_password: true } }),
    });
    if (!create.ok) {
      const errText = await create.text();
      if (create.status === 422 || /already.*registered|already exists/i.test(errText)) {
        return json({ success: false, error: 'An account with this email already exists but is not linked to this volunteer. Ask an admin to check volunteer_auth_links / auth.users for ' + email + ' and link it manually.' }, 409);
      }
      throw new Error(`Failed to create auth user: ${create.status} ${errText}`);
    }
    const created = await create.json();
    const authUserId: string = created.id;

    await fetch(`${SUPABASE_URL}/rest/v1/volunteer_auth_links?on_conflict=auth_user_id`, {
      method: 'POST',
      headers: { ...adminHeaders, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ auth_user_id: authUserId, volunteer_id }),
    });

    return json({ success: true, tempPassword });
  } catch (err) {
    return json({ success: false, error: String((err as Error)?.message || err) }, 500);
  }
});
