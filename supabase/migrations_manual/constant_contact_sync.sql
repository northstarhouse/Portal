-- Constant Contact: new Newsletter Sign Up and Volunteer Sign Up submissions are added to a Constant Contact list.
-- cc_connection holds the OAuth tokens (server only: row level security on, no policies, so only the service role can read it).
-- cc_sync_log is a plain log the Portal can read. Safe to re-run.

create table if not exists public.cc_connection (
  id int primary key default 1 check (id = 1),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  oauth_state text,
  newsletter_list_id text,
  newsletter_list_name text,
  volunteer_list_id text,
  volunteer_list_name text,
  connected_at timestamptz,
  updated_at timestamptz default now()
);
alter table public.cc_connection enable row level security;
insert into public.cc_connection (id) values (1) on conflict (id) do nothing;

create table if not exists public.cc_sync_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  response_id uuid,
  source text,
  email text,
  status text,
  detail text
);
alter table public.cc_sync_log enable row level security;
drop policy if exists cc_sync_log_read on public.cc_sync_log;
create policy cc_sync_log_read on public.cc_sync_log for select to anon, authenticated using (true);

create or replace function public.trg_cc_sync_signup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.form_id in ('ee7add8b-277c-4309-8c45-60b13b3befd3'::uuid, '11342c74-d0f0-4cb3-9b9e-57f30b4ae3a7'::uuid) then
    perform net.http_post(
      url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/constant-contact',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
      body := jsonb_build_object('action', 'sync', 'response_id', new.id),
      timeout_milliseconds := 20000
    );
  end if;
  return new;
exception when others then
  return new; -- never block a form submission because of Constant Contact
end;
$$;

drop trigger if exists cc_sync_signup on public.nsh_form_responses;
create trigger cc_sync_signup after insert on public.nsh_form_responses
  for each row execute function public.trg_cc_sync_signup();
