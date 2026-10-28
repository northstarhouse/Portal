-- The Portal now shows the same Events Committee page as the Volunteer Hub (mirrored code, same tables).
-- The Hub reaches these tables as a signed-in volunteer; the Portal reaches them with a Portal session
-- (has_valid_app_session()). Give the Portal the same read/write access on the two tables the page edits.
-- (add_events_committee_portal_read.sql already allowed reading events_committee.)

-- events_committee: the events themselves and everything planned for them
drop policy if exists "portal session insert events_committee" on events_committee;
create policy "portal session insert events_committee" on events_committee for insert to anon with check (public.has_valid_app_session());
drop policy if exists "portal session update events_committee" on events_committee;
create policy "portal session update events_committee" on events_committee for update to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());
drop policy if exists "portal session delete events_committee" on events_committee;
create policy "portal session delete events_committee" on events_committee for delete to anon using (public.has_valid_app_session());

-- events_committee_areas: the per-area planning tabs (programs, volunteers, logistics, marketing, ...)
drop policy if exists "portal session read events_committee_areas" on events_committee_areas;
create policy "portal session read events_committee_areas" on events_committee_areas for select to anon using (public.has_valid_app_session());
drop policy if exists "portal session insert events_committee_areas" on events_committee_areas;
create policy "portal session insert events_committee_areas" on events_committee_areas for insert to anon with check (public.has_valid_app_session());
drop policy if exists "portal session update events_committee_areas" on events_committee_areas;
create policy "portal session update events_committee_areas" on events_committee_areas for update to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());
drop policy if exists "portal session delete events_committee_areas" on events_committee_areas;
create policy "portal session delete events_committee_areas" on events_committee_areas for delete to anon using (public.has_valid_app_session());
