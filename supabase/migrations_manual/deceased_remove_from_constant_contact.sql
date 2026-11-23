-- When a donor is marked deceased, take their email off every Constant Contact list (mail-list-sync, action remove-contact).
-- Works whoever marks them (Portal or the donors app). Marking someone living again does not add them back. Safe to re-run.
create or replace function public.trg_donor_deceased_cc()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.deceased is true and coalesce(old.deceased, false) is false and coalesce(trim(new.email), '') <> '' then
    perform net.http_post(
      url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/mail-list-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
      body := jsonb_build_object('action', 'remove-contact', 'email', new.email),
      timeout_milliseconds := 20000
    );
  end if;
  return new;
exception when others then
  return new; -- never block saving a donor
end;
$$;

drop trigger if exists donor_deceased_cc on public.donors;
create trigger donor_deceased_cc after update of deceased on public.donors
  for each row execute function public.trg_donor_deceased_cc();
