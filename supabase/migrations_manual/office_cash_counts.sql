-- Office cash box counts: what was physically in the box on a given day, kept separate from the Cash Log so a count never
-- changes the ledger. The Office Cash page compares the latest count to the expected "Cash in the Box" total.
-- Apply one statement at a time.

create table if not exists public.office_cash_counts (
  id uuid primary key default gen_random_uuid(),
  count_date date not null,
  counted numeric not null,
  expected numeric,
  note text,
  counted_by text,
  created_at timestamptz not null default now()
);

alter table public.office_cash_counts enable row level security;

create policy "portal session all office_cash_counts" on public.office_cash_counts for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

grant select, insert, update, delete on public.office_cash_counts to anon;

insert into public.office_cash_counts (count_date, counted, expected, note, counted_by) values ('2026-11-12', 634.41, 745.44, 'Box count. Expected per Cash in the Box (2026).', 'Haley Wright');
