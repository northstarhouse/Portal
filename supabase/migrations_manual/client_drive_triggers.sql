-- Files a client's paperwork into Google Drive (the client-drive-sync function) whenever something is submitted:
-- pre-booking form, pre-event questionnaire, post-event feedback form, insurance upload, or a fully signed contract.

-- A short-lived lock per client, so two submissions arriving together never create duplicate files.
create table if not exists public.venue_drive_locks (response_id uuid primary key, until timestamptz not null);
alter table public.venue_drive_locks enable row level security;
create or replace function public.claim_drive_lock(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare got int;
begin
  insert into venue_drive_locks (response_id, until) values (p_id, now() + interval '90 seconds')
  on conflict (response_id) do update set until = excluded.until where venue_drive_locks.until < now();
  get diagnostics got = row_count;
  return got > 0;
end $$;
create or replace function public.release_drive_lock(p_id uuid) returns void
language sql security definer set search_path = public as $$ update venue_drive_locks set until = now() where response_id = p_id $$;
revoke all on function public.claim_drive_lock(uuid), public.release_drive_lock(uuid) from public, anon, authenticated;
grant execute on function public.claim_drive_lock(uuid), public.release_drive_lock(uuid) to service_role;

create or replace function public.fire_client_drive_sync(p_response_id uuid) returns void
language plpgsql security definer set search_path = public, net as $$
begin
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/client-drive-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := jsonb_build_object('action', 'sync', 'response_id', p_response_id),
    timeout_milliseconds := 120000);
exception when others then null; -- filing must never block a submission
end $$;

-- forms: pre-booking (wedding, events), pre-event questionnaire, post-event feedback
create or replace function public.trg_client_drive_form() returns trigger language plpgsql as $$
begin
  if new.form_id in ('a3a383f7-e1db-4344-9dec-ea879ad3406d', '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8', 'e9be06b9-6788-41bc-a78a-28e02b8b749a', '5ebe4961-d50e-47f1-9071-e81c2ada6233') then
    perform public.fire_client_drive_sync(new.id);
  end if;
  return new;
end $$;
drop trigger if exists client_drive_form on public.nsh_form_responses;
create trigger client_drive_form after insert or update of answers on public.nsh_form_responses
  for each row execute function public.trg_client_drive_form();

-- a contract becoming fully signed
create or replace function public.trg_client_drive_contract() returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.fire_client_drive_sync(new.response_id);
  end if;
  return new;
end $$;
drop trigger if exists client_drive_contract on public.venue_agreement_versions;
create trigger client_drive_contract after update of status on public.venue_agreement_versions
  for each row execute function public.trg_client_drive_contract();

-- an insurance certificate being uploaded
create or replace function public.trg_client_drive_insurance() returns trigger language plpgsql as $$
begin
  if new.prebooking_form_response_id is not null and new.insurance_drive_url is not null
     and new.insurance_drive_url is distinct from old.insurance_drive_url then
    perform public.fire_client_drive_sync(new.prebooking_form_response_id);
  end if;
  return new;
end $$;
drop trigger if exists client_drive_insurance on public.venue_inquiries;
create trigger client_drive_insurance after update of insurance_drive_url on public.venue_inquiries
  for each row execute function public.trg_client_drive_insurance();
