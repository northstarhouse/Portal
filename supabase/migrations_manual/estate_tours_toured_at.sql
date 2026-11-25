-- "Toured Venue" button on a tour: records that the tour really happened. It sends nothing and changes nothing else
-- (the tour stays booked, so the automatic pre-booking form email still goes out as before); the tour just leaves the
-- upcoming list straight away instead of lingering until the next day. Safe to re-run.
alter table public.estate_tours add column if not exists toured_at timestamptz;
