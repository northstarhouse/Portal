-- Pre-bookings on the Google Calendar as soft holds (see supabase/functions/venue-soft-holds).
-- venue_soft_holds remembers which calendar entry belongs to which pre-booking form response, so the entry can be renamed
-- when the agreement is signed and removed when the hold is released or the submission is deleted. Service role only.
-- Safe to run more than once.

create table if not exists venue_soft_holds (
  response_id uuid primary key,
  gcal_event_id text,
  event_date date,
  summary text,
  state text not null default 'active', -- active | released | existing (already on the calendar by hand; left alone)
  updated_at timestamptz not null default now()
);
alter table venue_soft_holds enable row level security;

create extension if not exists pg_net with schema extensions;
select cron.unschedule('venue-soft-holds') where exists (select 1 from cron.job where jobname = 'venue-soft-holds');
select cron.schedule(
  'venue-soft-holds',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/venue-soft-holds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
