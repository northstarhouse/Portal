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

// Readable, unambiguous characters only -- this gets typed by hand off an email.
function genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

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

    const tempPassword = genTempPassword();

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

    // No link yet -- an auth user might already exist for this email (e.g.
    // they signed up once before the link table existed), so look it up
    // rather than risk a duplicate-email error from createUser.
    const lookupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers: adminHeaders,
    });
    const lookup = await lookupRes.json();
    const foundUser = Array.isArray(lookup?.users) ? lookup.users[0] : Array.isArray(lookup) ? lookup[0] : null;

    let authUserId: string;
    if (foundUser?.id) {
      authUserId = foundUser.id;
      await setPassword(authUserId, tempPassword);
    } else {
      const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ email, password: tempPassword, email_confirm: true, user_metadata: { must_change_password: true } }),
      });
      if (!create.ok) throw new Error(`Failed to create auth user: ${create.status} ${await create.text()}`);
      const created = await create.json();
      authUserId = created.id;
    }

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
