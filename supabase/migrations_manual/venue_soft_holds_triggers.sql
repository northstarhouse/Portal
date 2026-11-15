-- Soft holds on the NSH calendar, triggered instead of polled: the moment a pre-booking booking record is created or its
-- date/name/status changes, an agreement version changes status (issued, signed, expired, declined...), or a pre-booking
-- submission is deleted, call venue-soft-holds. The function re-reads everything itself and is idempotent, so extra calls
-- are harmless. The 15-minute cron becomes an hourly safety net (catches anything a trigger call missed, e.g. a timeout).
-- Safe to run more than once.

create extension if not exists pg_net with schema extensions;

create or replace function public.trg_venue_soft_holds_sync()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/venue-soft-holds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  return null;
exception when others then
  raise warning 'venue soft hold sync call failed: %', sqlerrm;
  return null;
end;
$$;

-- Booking record created / date, name or status changed (once per statement, not per row).
drop trigger if exists venue_soft_holds_on_inquiry on venue_inquiries;
create trigger venue_soft_holds_on_inquiry
  after insert or delete or update of event_date, name, status, prebooking_form_response_id on venue_inquiries
  for each statement execute function public.trg_venue_soft_holds_sync();

-- Agreement issued / signed / expired / declined / withdrawn.
drop trigger if exists venue_soft_holds_on_agreement on venue_agreement_versions;
create trigger venue_soft_holds_on_agreement
  after insert or delete or update of status on venue_agreement_versions
  for each statement execute function public.trg_venue_soft_holds_sync();

-- Pre-booking submission deleted from the Portal.
drop trigger if exists venue_soft_holds_on_response_delete on nsh_form_responses;
create trigger venue_soft_holds_on_response_delete
  after delete on nsh_form_responses
  for each statement execute function public.trg_venue_soft_holds_sync();

-- Polling becomes an hourly backup.
select cron.unschedule('venue-soft-holds') where exists (select 1 from cron.job where jobname = 'venue-soft-holds');
select cron.schedule(
  'venue-soft-holds',
  '7 * * * *',
  $cron$
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
  $cron$
);
