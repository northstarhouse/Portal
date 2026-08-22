-- Run this once in the Supabase SQL editor.
-- Fixes "Updates aren't sticking" on Ideas & Initiatives: the "Ideas" table
-- has row-level security enabled with no permissive policies, so every
-- INSERT/UPDATE from the Portal's anon key was silently rejected
-- (42501 row-level security violation) -- silently because the app's
-- saveEdit()/addIdea() don't check the response status, so the UI updated
-- optimistically and looked like it saved, then reverted on next load.
-- Portal has no per-user Supabase Auth (single shared password gate at the
-- app level), so every other table in this project is world-read/write for
-- the anon key -- this brings Ideas in line with that same pattern.

drop policy if exists "public read"   on "Ideas";
drop policy if exists "public insert" on "Ideas";
drop policy if exists "public update" on "Ideas";
drop policy if exists "public delete" on "Ideas";

create policy "public read"   on "Ideas" for select using (true);
create policy "public insert" on "Ideas" for insert with check (true);
create policy "public update" on "Ideas" for update using (true);
create policy "public delete" on "Ideas" for delete using (true);
