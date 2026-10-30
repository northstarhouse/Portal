-- Run once in the Supabase SQL editor.
-- Messages couples send from their event page show in Needs your attention until staff mark them handled.
alter table venue_messages add column if not exists handled_at timestamptz;

-- Staff (signed in to the Portal) may mark a message handled.
drop policy if exists "venue_messages staff update" on venue_messages;
create policy "venue_messages staff update" on venue_messages
  for update to anon, authenticated
  using (has_valid_app_session()) with check (has_valid_app_session());
