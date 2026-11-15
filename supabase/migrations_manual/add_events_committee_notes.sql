-- Events Committee > Checklist: a note taker. Quick notes are typed in one after another and attached later
-- (to a duty, the day-of timeline, a vendor or the after notes).
alter table events_committee add column if not exists notes jsonb not null default '[]'::jsonb;
