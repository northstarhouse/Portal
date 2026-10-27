-- RSVP events store their answer choices (e.g. Attending / Attending +1 / Can't Make It) in vol_events.options.
-- The Portal's Form Builder and the forms admin both write this column on save; without it every save fails.
alter table vol_events add column if not exists options text[] not null default '{}';
