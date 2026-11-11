-- Volunteer Hub > Events Committee > 2027 Event Plan.
-- The committee's confirmed list of events for a year (from the "2027 Events List" vote). Each one gets a highlighted
-- "Committee decisions" note, and is finalized into a real Events Committee event (events_committee) once its date,
-- start/end times, pricing and budget are filled in.
-- Apply one statement at a time.

create table if not exists public.events_plan (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  name text not null,
  sort_order int not null default 0,
  date date,
  start_time text,
  end_time text,
  pricing text,
  budget text,
  decisions text,
  decisions_updated_at timestamptz,
  decisions_updated_by text,
  finalized_event_id uuid,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events_plan enable row level security;

create policy "authenticated all events_plan" on public.events_plan for all to authenticated using (true) with check (true);

create policy "portal session all events_plan" on public.events_plan for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

grant select, insert, update, delete on public.events_plan to authenticated, anon;

insert into public.events_plan (year, name, sort_order) values
  (2027, 'Speaker Series', 0),
  (2027, 'Community Game Days', 1),
  (2027, 'Spring Magic Shows', 2),
  (2027, 'Mother''s Day Tea', 3),
  (2027, 'Midsummer Festival', 4),
  (2027, 'Volunteer Appreciation Party', 5),
  (2027, 'North Star Sessions — Winter Music Series', 6),
  (2027, 'Fall Magic Show', 7),
  (2027, 'State of the Star Reception', 8),
  (2027, 'Christmas at North Star House', 9),
  (2027, 'A Christmas Carol Reading', 10),
  (2027, 'Trivia Night', 11),
  (2027, 'Spring Fundraiser', 12),
  (2027, '1920s Speakeasy Event', 13),
  (2027, 'Signature Fundraising Event', 14),
  (2027, 'Chamber Mixer', 15);
