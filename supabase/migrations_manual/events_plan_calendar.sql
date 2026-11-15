-- 2027 Event List (events_plan) -> NSH Google Calendar + website availability, via venue-soft-holds.
-- events_plan_calendar remembers which calendar entry belongs to which event day, so a changed date / time / name moves the
-- entry and a changed decision or deleted event removes it. state: creating | active | existing (already on the calendar by
-- hand; left alone). Triggered on every change to events_plan (once per statement). Service role only. Safe to re-run.

create table if not exists events_plan_calendar (
  plan_id uuid not null,
  day_index int not null default 0,
  gcal_event_id text,
  event_date date,
  start_time text,
  end_time text,
  summary text,
  state text not null default 'active',
  updated_at timestamptz not null default now(),
  primary key (plan_id, day_index)
);
alter table events_plan_calendar enable row level security;

drop trigger if exists events_plan_calendar_sync on events_plan;
create trigger events_plan_calendar_sync
  after insert or delete or update of name, date, start_time, end_time, multi_day, days, final_decision on events_plan
  for each statement execute function public.trg_venue_soft_holds_sync();

-- The Winter Music Series days are already on the calendar by hand as the "Rita Hosking Residency" entries (no shared name
-- word for the automatic check to find), so record them as existing instead of adding duplicates.
insert into events_plan_calendar (plan_id, day_index, event_date, summary, state)
select p.id, d.idx - 1, (d.day->>'date')::date, 'Rita Hosking Residency (on the calendar by hand)', 'existing'
from events_plan p, jsonb_array_elements(p.days) with ordinality as d(day, idx)
where p.year = 2027 and p.name ilike 'North Star Sessions%' and p.multi_day
on conflict do nothing;
