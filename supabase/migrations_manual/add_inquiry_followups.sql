-- 48-hour follow-up for website wedding inquiries (send-inquiry-followups function).
-- One row per inquiry that has been followed up. Server-only: RLS on, no policies.
create table if not exists inquiry_followups (
  response_id uuid primary key references nsh_form_responses(id) on delete cascade,
  email text not null,
  date_status text,
  sent_at timestamptz not null default now()
);
alter table inquiry_followups enable row level security;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Hourly, at 15 past.
select cron.schedule(
  'send-inquiry-followups',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-inquiry-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    timeout_milliseconds := 30000
  );
  $$
);
