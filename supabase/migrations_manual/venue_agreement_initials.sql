-- Initials the clients type next to each numbered term when they sign the venue agreement.
create table if not exists public.venue_agreement_initials (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null,
  signer_id   uuid not null,
  section     integer not null,
  initials    text not null,
  created_at  timestamptz not null default now(),
  unique (signer_id, section)
);
alter table public.venue_agreement_initials enable row level security;
-- No policies: only the venue-agreements function (service key) reads or writes it.
