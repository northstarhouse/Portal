-- Run once in the Supabase SQL editor.
-- "North Star House Updates": things that got done and things coming up, entered in the Portal and included in the monthly board email.
create table if not exists nsh_updates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('done', 'upcoming')),
  title text not null,
  details text,
  happened_on date,             -- the day it got done, or the day it is expected / scheduled
  area text,                    -- optional: Construction, Grounds, Events, ... or General
  include_in_email boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists nsh_updates_date_idx on nsh_updates (happened_on desc);
alter table nsh_updates enable row level security;
drop policy if exists "nsh_updates staff all" on nsh_updates;
create policy "nsh_updates staff all" on nsh_updates for all to anon, authenticated
  using (has_valid_app_session()) with check (has_valid_app_session());
