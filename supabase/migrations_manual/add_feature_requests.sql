-- Requests for new Portal features, written from Venue Rentals > Tools > "Make a feature request".
-- Only a signed-in Portal session can read, add or change them.
create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  area text,
  priority text not null default 'normal',
  status text not null default 'open',
  requested_by text,
  created_at timestamptz not null default now()
);
alter table public.feature_requests enable row level security;
drop policy if exists feature_requests_read on public.feature_requests;
create policy feature_requests_read on public.feature_requests for select using (has_valid_app_session());
drop policy if exists feature_requests_insert on public.feature_requests;
create policy feature_requests_insert on public.feature_requests for insert with check (has_valid_app_session());
drop policy if exists feature_requests_update on public.feature_requests;
create policy feature_requests_update on public.feature_requests for update using (has_valid_app_session()) with check (has_valid_app_session());
