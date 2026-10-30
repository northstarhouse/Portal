-- "Confirm My Tour" button in the 24-hour reminder: each tour gets a private token, and confirming stamps confirmed_at.
alter table public.estate_tours add column if not exists confirm_token uuid not null default gen_random_uuid();
alter table public.estate_tours add column if not exists confirmed_at timestamptz;
create unique index if not exists estate_tours_confirm_token_key on public.estate_tours (confirm_token);
