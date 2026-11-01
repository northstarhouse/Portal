-- Every morning: pull PayPal's payments (and save the real fees on Portal records), then back new payments up to the Google Sheet.
-- Run once, after you are happy with the Treasurer page and the Sheet.
select cron.schedule('sync-paypal-transactions', '0 13 * * *', $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/sync-paypal-transactions',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
select cron.schedule('backup-payments-to-sheet', '30 13 * * *', $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/backup-payments-to-sheet',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
