-- Run this once in the Supabase SQL editor.
-- Diagnosing a "Disk IO budget depleting" alert from Supabase turned up
-- net._http_response sitting at 5.3MB on disk for only 8 live rows -- the
-- existing nightly prune-logs job (job id 8) already deletes old rows and
-- runs a plain VACUUM, but plain VACUUM only marks space reusable, it never
-- shrinks the file on disk. calendar_events_cache showed the same pattern
-- (47 dead rows for 1 live row). VACUUM FULL actually reclaims the space;
-- it takes a brief exclusive lock, which is fine at 3:30am.

select cron.alter_job(
  job_id := 8,
  command := $cmd$
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from net._http_response    where created  < now() - interval '6 hours';
  vacuum full cron.job_run_details;
  vacuum full net._http_response;
  vacuum full calendar_events_cache;
  $cmd$
);
