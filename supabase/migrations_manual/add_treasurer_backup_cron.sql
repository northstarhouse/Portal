-- Backs payments up to the treasurer's Google Sheet every 3 hours (only adds what is missing).
-- Run after the Sheet is shared with the backup account and "Back up now" works on the Treasurer page.
select cron.schedule(
  'backup-payments-to-sheet',
  '15 */3 * * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/backup-payments-to-sheet',
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
