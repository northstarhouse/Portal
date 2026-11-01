-- The list of people who can be assigned as a wedding's site manager (Venue Rentals > Clients > Assign Site Managers).
-- Which one is assigned to which wedding is saved on the client's own record (answers.__venue_checklist.site_manager).
create table if not exists public.venue_site_managers (
  name text primary key,
  created_at timestamptz not null default now()
);
alter table public.venue_site_managers enable row level security;
drop policy if exists venue_site_managers_app on public.venue_site_managers;
create policy venue_site_managers_app on public.venue_site_managers for all using (has_valid_app_session()) with check (has_valid_app_session());
insert into public.venue_site_managers (name) values ('Derek'), ('Jen'), ('Haley') on conflict do nothing;
