-- One-time scheduled sends of the Fall Magic Show guest lists to
-- media@thenorthstarhouse.org (send-event-guest-list function): Friday's
-- show (Oct 23, 2026) at 5:00 PM Pacific, Saturday's (Oct 24, 2026) at
-- 6:00 PM Pacific. PDT is UTC-7 in October, so:
--   Fri Oct 23 17:00 PDT -> Sat Oct 24 00:00 UTC  =>  cron '0 0 24 10 *'
--   Sat Oct 24 18:00 PDT -> Sun Oct 25 01:00 UTC  =>  cron '0 1 25 10 *'
-- Both are day+month-specific, so they only ever match this one date.
select cron.schedule(
  'send-magic-show-guest-list-friday',
  '0 0 24 10 *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-event-guest-list',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := jsonb_build_object('eventSlug', 'fall-magic-show-2026'),
    timeout_milliseconds := 30000
  );
  $$
);

select cron.schedule(
  'send-magic-show-guest-list-saturday',
  '0 1 25 10 *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-event-guest-list',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := jsonb_build_object('eventSlug', 'fall-magic-show-2026-saturday'),
    timeout_milliseconds := 30000
  );
  $$
);
