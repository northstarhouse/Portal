-- Run once in the Supabase SQL editor.
-- Lets the venue@ inbox import (sync-venue-inbox function) file each email once, then runs it every 5 minutes.
alter table venue_messages add column if not exists gmail_id text;
create unique index if not exists venue_messages_gmail_id_key on venue_messages (gmail_id);

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'sync-venue-inbox',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/sync-venue-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    timeout_milliseconds := 30000
  );
  $$
);
