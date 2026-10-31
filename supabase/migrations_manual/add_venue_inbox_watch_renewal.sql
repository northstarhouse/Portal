-- Run once in the Supabase SQL editor, AFTER the Gmail push (Pub/Sub) setup is done and GMAIL_PUBSUB_TOPIC is set.
-- Gmail's "tell me when something changes" subscription lasts 7 days, so this renews it once a week (Mondays 6am UTC).
-- That is one small call a week; email itself is imported the moment Gmail announces it, not on a timer.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'renew-venue-inbox-watch',
  '0 6 * * 1',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/sync-venue-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := '{"action":"watch"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
