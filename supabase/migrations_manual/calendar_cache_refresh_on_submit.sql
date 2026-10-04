-- Already applied live -- recorded here for history.
-- refresh-calendar-cache only ever ran on a timer (recently throttled from
-- every 15 min down to 3x/day after the Disk IO investigation). It never
-- needed to wait for a scheduled poll when the change came from inside our
-- own apps -- add-tour-to-calendar and add-calendar-event (the only two
-- functions that create events) now call refresh-calendar-cache themselves
-- right after a successful create, so our own submissions show up
-- immediately. The standing poll is dropped to 8am/6pm, since it's now only
-- a safety net for changes made directly in Google Calendar by staff,
-- outside of Portal/Volunteer Hub entirely.

select cron.alter_job(job_id := 7, schedule := '0 8,18 * * *');
