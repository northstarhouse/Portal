-- Website events come off the website by themselves once they have ended. Safe to re-run.
--
-- The website only shows site_events rows whose status is 'published'. Every 30 minutes this marks a published event
-- 'archived' once its end time has passed (an event with no end time counts as over 12 hours after it starts).
-- Events whose date is still to be announced are left alone. Archived events stay in the Portal (Admin > New Event shows
-- them as "Ended") and keep their ticket sales records; setting one back to 'published' puts it on the website again.

create or replace function public.archive_ended_site_events()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer;
begin
  update site_events
  set status = 'archived', updated_at = now()
  where status = 'published'
    and coalesce(date_tbd, false) = false
    and start_at is not null
    and coalesce(end_at, start_at + interval '12 hours') < now();
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.archive_ended_site_events() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('archive-ended-site-events');
exception when others then null;
end $$;

select cron.schedule('archive-ended-site-events', '*/30 * * * *', $cron$select public.archive_ended_site_events()$cron$);
