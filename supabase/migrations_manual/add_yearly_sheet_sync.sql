-- Keeps the yearly Financial Overview tabs in the Google Sheet current: any change to the records behind them
-- (donations, sponsors, budget, earnings, cash log, rentals, venue payments, hand-entered payments, manual venue payments)
-- asks the backup function to refresh them. Changes that arrive while a refresh is running are folded into one more pass.
create table if not exists public.sheet_sync_state (
  id int primary key default 1 check (id = 1),
  running_until timestamptz not null default 'epoch',
  pending boolean not null default false
);
insert into public.sheet_sync_state (id) values (1) on conflict do nothing;
alter table public.sheet_sync_state enable row level security; -- service role only

create or replace function public.notify_yearly_sheet_sync()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/backup-payments-to-sheet',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := '{"action":"yearly"}'::jsonb,
    timeout_milliseconds := 120000
  );
  return null;
exception when others then
  return null; -- never block a save
end $$;

do $$
declare t text;
begin
  foreach t in array array['donations', 'donors', 'Sponsors', 'Sponsor In-Kind', 'Op Budget', 'Op Earnings', 'Cash Log', 'Creative Rentals', 'venue_payments', 'treasurer_entries'] loop
    execute format('drop trigger if exists yearly_sheet_sync on public.%I', t);
    execute format('create trigger yearly_sheet_sync after insert or update or delete on public.%I for each statement execute function public.notify_yearly_sheet_sync()', t);
  end loop;
end $$;

-- Payments logged by hand on a venue client's card live inside the client's form response.
drop trigger if exists yearly_sheet_sync_manual_venue on public.nsh_form_responses;
create trigger yearly_sheet_sync_manual_venue after update on public.nsh_form_responses
  for each row when (old.answers->'__venue_checklist'->'manual_payments' is distinct from new.answers->'__venue_checklist'->'manual_payments')
  execute function public.notify_yearly_sheet_sync();
