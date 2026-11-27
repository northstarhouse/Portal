-- Sponsor year: which recognition cycle a sponsor contribution counts toward, kept separate from the date it was received.
-- The received date stays on receipts and in Finance. The sponsor year drives Current/Past, tier level and the brick year.
-- Rule: a contribution received on or after that year's sponsorship party date counts toward the next year.
-- Party dates live in sponsor_party_dates (one row per year). With no party date for a year, the calendar year is used.
-- A sponsor year typed by hand is kept (sponsor_year_manual) until it is cleared. Safe to re-run.

create table if not exists public.sponsor_party_dates (
  year int primary key,
  party_date date not null,
  updated_at timestamptz not null default now()
);
alter table public.sponsor_party_dates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'sponsor_party_dates' and policyname = 'token_can_read') then
    create policy token_can_read on public.sponsor_party_dates for select to anon, authenticated using (has_valid_app_session());
    create policy token_can_insert on public.sponsor_party_dates for insert to anon, authenticated with check (has_valid_app_session());
    create policy token_can_update on public.sponsor_party_dates for update to anon, authenticated using (has_valid_app_session()) with check (has_valid_app_session());
    create policy token_can_delete on public.sponsor_party_dates for delete to anon, authenticated using (has_valid_app_session());
  end if;
end $$;

insert into public.sponsor_party_dates (year, party_date) values (2026, '2026-11-13') on conflict (year) do nothing;

alter table public."Sponsor In-Kind" add column if not exists sponsor_year int;
alter table public."Sponsor In-Kind" add column if not exists sponsor_year_manual boolean not null default false;

create or replace function public.sponsor_year_for(d date) returns int
language sql stable set search_path = public as $$
  select case when d is null then null
    when exists (select 1 from sponsor_party_dates p where p.year = extract(year from d)::int and d >= p.party_date)
      then extract(year from d)::int + 1
    else extract(year from d)::int end
$$;

create or replace function public.set_sponsor_year() returns trigger
language plpgsql set search_path = public as $$
declare v_auto int := sponsor_year_for(new.date);
begin
  if tg_op = 'INSERT' then
    new.sponsor_year_manual := new.sponsor_year is not null and new.sponsor_year is distinct from v_auto;
  elsif new.sponsor_year is distinct from old.sponsor_year then
    -- typed by hand: keep it; cleared: go back to automatic
    new.sponsor_year_manual := new.sponsor_year is not null and new.sponsor_year is distinct from v_auto;
  end if;
  if not new.sponsor_year_manual then new.sponsor_year := v_auto; end if;
  return new;
end $$;

drop trigger if exists trg_set_sponsor_year on public."Sponsor In-Kind";
create trigger trg_set_sponsor_year before insert or update of date, sponsor_year on public."Sponsor In-Kind"
  for each row execute function public.set_sponsor_year();

-- changing a party date re-sorts every automatic contribution from that year and the next
create or replace function public.resort_sponsor_years() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update "Sponsor In-Kind" set sponsor_year = sponsor_year_for(date)
  where not sponsor_year_manual and sponsor_year is distinct from sponsor_year_for(date);
  return null;
end $$;

drop trigger if exists trg_resort_sponsor_years on public.sponsor_party_dates;
create trigger trg_resort_sponsor_years after insert or update or delete on public.sponsor_party_dates
  for each statement execute function public.resort_sponsor_years();

-- fill every existing contribution
update public."Sponsor In-Kind" set sponsor_year = sponsor_year_for(date)
where not sponsor_year_manual and sponsor_year is distinct from sponsor_year_for(date);
