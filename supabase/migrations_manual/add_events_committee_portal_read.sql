-- Lets the Portal read the Events Committee list (events_committee) so its Event Overviews page can mirror the
-- Volunteer Hub's Events Committee page (hidden, cancelled and committee-only events).
-- Read only, and only for a valid Portal session (same check the other Portal tables use).
drop policy if exists "portal session read events_committee" on events_committee;
create policy "portal session read events_committee"
  on events_committee for select
  to anon
  using (public.has_valid_app_session());
