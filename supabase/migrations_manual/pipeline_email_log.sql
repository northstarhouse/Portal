-- Safety net for the hourly pipeline: it records every automatic email it sends (recipient + subject) and refuses to send the
-- same subject to the same address again within 7 days, whatever else goes wrong. Only the service role touches it. Safe to re-run.
create table if not exists public.pipeline_email_log (
  id bigserial primary key,
  to_email text not null,
  subject text not null,
  sent_at timestamptz not null default now()
);
create index if not exists pipeline_email_log_lookup on public.pipeline_email_log (to_email, subject, sent_at desc);
alter table public.pipeline_email_log enable row level security;
