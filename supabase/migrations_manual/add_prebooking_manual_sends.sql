-- Pre-booking forms sent by hand (Venue Rentals > Inquiries > "Send Pre-Booking Form"), for people who never went through an
-- inquiry: nonprofits and other groups with a special arrangement. The arrangement is recorded here so the special rate can be
-- applied when their agreement is prepared ('standard' or 'bylt').
create table if not exists public.prebooking_manual_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  event_type text not null,
  arrangement text not null default 'standard',
  form_url text,
  sent_by text,
  sent_at timestamptz not null default now()
);
create index if not exists prebooking_manual_sends_email on public.prebooking_manual_sends (lower(email));
alter table public.prebooking_manual_sends enable row level security;
drop policy if exists prebooking_manual_sends_read on public.prebooking_manual_sends;
create policy prebooking_manual_sends_read on public.prebooking_manual_sends for select using (has_valid_app_session());
