-- The nightly "prune-logs" job has been failing every night ("VACUUM cannot run inside a transaction block"): a cron job
-- runs all its statements as one transaction, and VACUUM FULL cannot. Because it failed, its deletes were rolled back too,
-- so old cron history and HTTP responses were never cleaned up. This keeps the deletes (the part that matters) and drops
-- the VACUUM FULL lines. Safe to re-run.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'prune-logs'),
  command := $job$
    delete from cron.job_run_details where end_time < now() - interval '7 days';
    delete from net._http_response    where created  < now() - interval '6 hours';
  $job$
);
