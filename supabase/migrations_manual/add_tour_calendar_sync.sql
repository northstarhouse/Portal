-- Run this once in the Supabase SQL editor, AFTER deploying the
-- add-tour-to-calendar edge function (and after sharing the actual
-- thenorthstarhouse@gmail.com Google Calendar with the service account's
-- client_email -- see the comment at the top of that function).
--
-- Fires whenever an estate_tours row's status becomes 'booked' (covers
-- both the public site's atomic slot-claim and Portal's own "Schedule a
-- Tour", since the hook is on the table itself, not any one app's write
-- path), and calls add-tour-to-calendar to create the real Google Calendar
-- event. The function re-reads the row itself and is idempotent on
-- gcal_event_id, so a retried delivery can't create a duplicate event.
--
-- Safe to run multiple times.

alter table estate_tours add column if not exists gcal_event_id text;

create extension if not exists pg_net with schema extensions;

create or replace function trg_estate_tour_booked_sync_calendar()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'booked' and new.gcal_event_id is null
     and (tg_op = 'INSERT' or old.status is distinct from 'booked') then
    perform net.http_post(
      url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/add-tour-to-calendar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
        'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
      ),
      body := jsonb_build_object('id', new.id),
      timeout_milliseconds := 15000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists estate_tour_booked_sync_calendar on estate_tours;
create trigger estate_tour_booked_sync_calendar
  after insert or update on estate_tours
  for each row execute function trg_estate_tour_booked_sync_calendar();
