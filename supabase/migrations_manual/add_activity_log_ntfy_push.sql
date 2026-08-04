-- Run this once in the Supabase SQL editor.
-- Pushes a phone notification (via ntfy.sh) for every activity_log event,
-- regardless of what inserted/updated the row — covers both rows written by
-- the Portal itself (logActivity() in src/app.jsx) and rows written directly
-- by other systems, e.g. voicemail transcriptions from the Volunteer Hub.
--
-- Requires the pg_net extension (bundled with every Supabase project).
-- Subscribe to the topic below from the ntfy app (iOS/Android) or
-- https://ntfy.sh/nsh-portal-activity-1106d1c1133f in a browser.

create extension if not exists pg_net with schema extensions;

create or replace function notify_ntfy_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  msg text;
  is_new_handled boolean;
  was_handled boolean;
begin
  if tg_op = 'INSERT' then
    msg := coalesce(new.description, new.action, 'Portal activity');
  elsif tg_op = 'UPDATE' then
    is_new_handled := (new.action = 'voicemail_handled') or (new.resolved is true);
    was_handled := (old.action = 'voicemail_handled') or (old.resolved is true);
    -- Only notify on the transition into "handled" — not on every edit
    -- (e.g. re-tagging an entry in the Activity Log admin panel).
    if is_new_handled and not was_handled then
      msg := coalesce(new.description, 'An item') || ' — handled' || case when new.handled_by is not null then ' by ' || new.handled_by else '' end;
    else
      return new;
    end if;
  end if;

  -- pg_net always sends JSON, so publish via ntfy's JSON API (POST to the
  -- bare https://ntfy.sh endpoint with topic/message/title in the body)
  -- rather than the plain-text "POST to /<topic>" form.
  perform net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object(
      'topic', 'nsh-portal-activity-1106d1c1133f',
      'title', 'North Star Portal',
      'message', msg
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_ntfy_activity_log_insert on activity_log;
create trigger trg_notify_ntfy_activity_log_insert
  after insert on activity_log
  for each row execute function notify_ntfy_activity_log();

drop trigger if exists trg_notify_ntfy_activity_log_update on activity_log;
create trigger trg_notify_ntfy_activity_log_update
  after update on activity_log
  for each row execute function notify_ntfy_activity_log();
