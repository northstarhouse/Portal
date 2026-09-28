-- Run this once in the Supabase SQL editor.
-- oot_notices' insert policy was scoped to the `anon` role only, so a real
-- logged-in volunteer submitting their own "Out of Town" notice from
-- Profile.jsx (whose requests carry an `authenticated`-role session token,
-- not the raw anon key) would have been silently rejected by RLS. Widens it
-- to match the permissive pattern used on every other table in this app.

drop policy if exists "Allow anon insert oot_notices" on oot_notices;
create policy "public insert" on oot_notices for insert with check (true);
