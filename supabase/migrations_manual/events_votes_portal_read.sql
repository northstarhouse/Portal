-- Let the Portal (signed-in staff session) read the Events Committee votes, for the vote counts on Admin > 2027 Event List.
create policy "portal session read events_vote_items" on public.events_vote_items for select to anon using (public.has_valid_app_session());
create policy "portal session read events_vote_parts" on public.events_vote_parts for select to anon using (public.has_valid_app_session());
create policy "portal session read events_votes" on public.events_votes for select to anon using (public.has_valid_app_session());
grant select on public.events_vote_items, public.events_vote_parts, public.events_votes to anon;
