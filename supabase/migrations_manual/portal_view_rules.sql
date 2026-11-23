-- Personalized Portal views: which sections a person does not see. Keyed by the email they sign in with.
-- `hidden` holds Portal section ids: donors, sponsors, volunteers, venue, admin, ideas, quarterly, board, meeting-reports.
-- This hides pages from their menu and the Overview; it is a view setting, not a lock on the underlying data. Safe to re-run.
create table if not exists public.portal_view_rules (
  email text primary key,
  hidden text[] not null default '{}',
  note text,
  updated_at timestamptz not null default now()
);
alter table public.portal_view_rules enable row level security;
drop policy if exists token_can_read on public.portal_view_rules;
drop policy if exists token_can_write on public.portal_view_rules;
create policy token_can_read on public.portal_view_rules for select to anon, authenticated using (has_valid_app_session());
create policy token_can_write on public.portal_view_rules for all to anon, authenticated using (has_valid_app_session()) with check (has_valid_app_session());

-- First person: Rich Hill (board member). Hidden: Donations, Sponsors, Volunteers, Venue Rentals, Admin.
insert into public.portal_view_rules (email, hidden, note)
select lower(trim("Email")), array['donors','sponsors','volunteers','venue','admin'], 'Rich Hill (board member)'
from public."2026 Volunteers" where id = 25 and coalesce(trim("Email"), '') <> ''
on conflict (email) do nothing;
