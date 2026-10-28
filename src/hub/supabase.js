// Stand-in for the Volunteer Hub's supabase-js client. The mirrored data layer (src/hub/lib/db.js) only asks it for a
// signed-in session; the Portal has none, so requests go out with the anon key and the Portal's own app-session
// token, which the Portal adds to every Supabase request (see installFetchGate in app.jsx).
export const supabase = {
  auth: { getSession: async () => ({ data: { session: null } }) },
};
