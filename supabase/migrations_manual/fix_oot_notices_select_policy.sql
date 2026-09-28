-- Run this once in the Supabase SQL editor.
-- oot_notices' SELECT policy was scoped to the `anon` role only (and gated
-- behind has_valid_app_session(), a Portal-specific check). A real logged-in
-- Volunteer Hub session queries as the `authenticated` role, which matched
-- no policy at all -- so the Out of Town board on Volunteer Hub has been
-- silently returning zero rows for any signed-in volunteer, indistinguishable
-- from "no one's out of town." Same class of bug as the insert policy fixed
-- earlier. Widens it to the permissive pattern used elsewhere in this app.

drop policy if exists "Allow app session read oot_notices" on oot_notices;
create policy "public select" on oot_notices for select using (true);
