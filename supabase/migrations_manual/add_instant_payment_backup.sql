-- Back a payment up to the treasurer's Google Sheet the moment it is saved (website orders, online venue payments,
-- gifts, and cash/checks entered on the Treasurer page). The daily job stays as a safety net.
-- The backup function only adds payments that are not in the Sheet yet, so extra calls do no harm.
create or replace function public.notify_payment_backup()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/backup-payments-to-sheet',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  return null;
exception when others then
  return null; -- never block a payment from being saved
end $$;

drop trigger if exists backup_on_ticket_order on public.ticket_orders;
create trigger backup_on_ticket_order after insert or update of status on public.ticket_orders
  for each row when (new.status = 'completed') execute function public.notify_payment_backup();

drop trigger if exists backup_on_venue_payment on public.venue_payments;
create trigger backup_on_venue_payment after insert on public.venue_payments
  for each row execute function public.notify_payment_backup();

drop trigger if exists backup_on_donation on public.donations;
create trigger backup_on_donation after insert on public.donations
  for each row execute function public.notify_payment_backup();

drop trigger if exists backup_on_treasurer_entry on public.treasurer_entries;
create trigger backup_on_treasurer_entry after insert on public.treasurer_entries
  for each row execute function public.notify_payment_backup();
