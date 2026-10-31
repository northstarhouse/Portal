-- Run once in the Supabase SQL editor.
-- Sends the monthly Board Update email on the 1st of each month at 8am Pacific (15:00 UTC).
-- It starts in TEST mode: every send goes only to media@thenorthstarhouse.org with a TEST banner.
-- To switch to the board once approved, run:
--   insert into private_config (key, value) values ('board_report_mode', 'live') on conflict (key) do update set value = 'live';
-- (and back to test: set value = 'test').
-- One run a month, so this adds almost nothing to the database.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'send-board-monthly-report',
  '0 15 1 * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-board-monthly-report',
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
