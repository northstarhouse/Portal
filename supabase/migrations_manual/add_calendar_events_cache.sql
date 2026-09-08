-- Run this once in the Supabase SQL editor.
--
-- Works around a real-browser problem where every /functions/v1/* call from
-- Portal's specific browser context gets a CORS error (confirmed: curl to
-- the exact same URL+key always succeeds, and Volunteer Hub's browser
-- calling the identical fetch-events function never has the problem --
-- only Portal does, and it's every edge function, not just calendar). REST
-- calls (/rest/v1/*) are confirmed working fine in that same browser.
--
-- So instead of Portal calling an edge function directly from the browser,
-- a cron job calls it server-side (net.http_post, no browser/CORS involved
-- at all) every 15 minutes to refresh this single-row cache table, and
-- Portal just does a plain REST read of it -- the gateway that's proven to
-- work.

create table if not exists calendar_events_cache (
  id int primary key default 1,
  events jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  constraint calendar_events_cache_single_row check (id = 1)
);

alter table calendar_events_cache enable row level security;

drop policy if exists "public read calendar_events_cache" on calendar_events_cache;
create policy "public read calendar_events_cache"
on calendar_events_cache for select using (true);

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'refresh-calendar-cache',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/refresh-calendar-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    timeout_milliseconds := 30000
  );
  $$
);
