-- Run this once in the Supabase SQL editor, AFTER deploying the
-- send-birthday-emails edge function (supabase functions deploy send-birthday-emails).
--
-- Dedup table: send-birthday-emails checks/updates this before/after every
-- send so the same volunteer never gets two birthday emails in the same
-- year, even if the daily cron run overlaps or is re-triggered.
create table if not exists volunteer_birthday_email_log (
  email text primary key,
  last_sent_year int not null,
  sent_at timestamptz not null default now()
);

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Daily at 15:00 UTC (~8am Pacific during PDT, ~7am during PST -- same
-- fixed-UTC-time simplification used by refresh-board-packets-daily).
select cron.schedule(
  'send-birthday-emails-daily',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-birthday-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    timeout_milliseconds := 30000
  );
  $$
);
