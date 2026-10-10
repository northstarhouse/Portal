-- Run this once in the Supabase SQL editor (already applied directly via
-- the CLI for this environment, kept here for reference / other envs).
-- Logs sends from the "Email Notices" admin feature -- public-facing
-- announcements (e.g. event cancellations) sent to ticket buyers, as
-- opposed to volunteer_email_logs which is for the internal volunteer
-- roster. Same shape as volunteer_email_logs plus event_slug/event_title
-- for context, since recipients here come from ticket_orders grouped by
-- event rather than a Team tag.

create table if not exists email_notices_log (
  id               uuid default gen_random_uuid() primary key,
  sent_at          timestamptz,
  event_slug       text,
  event_title      text,
  subject          text,
  recipient_count  integer,
  recipients       text[],
  sender           text
);

alter table email_notices_log enable row level security;
create policy "allow all" on email_notices_log for all using (true);
