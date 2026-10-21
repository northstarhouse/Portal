-- Mirrors tours_due_for_1h_reminder's America/Los_Angeles wall-clock -> UTC
-- handling. Window is 1 hour wide (vs that RPC's 1-hour-wide pre-tour
-- window) to match this pipeline's hourly cron cadence instead of the
-- reminders' 15-minute one, so each row is still caught exactly once.
create or replace function public.tours_due_for_prebooking_email()
returns setof estate_tours
language sql
stable
as $function$
  select *
  from public.estate_tours
  where status = 'booked'
    and prebooking_form_sent_at is null
    and date is not null and start_time is not null
    and (date + start_time) at time zone 'America/Los_Angeles'
        between now() - interval '2 hours' and now() - interval '1 hours'
$function$;
