-- Run this once in the Supabase SQL editor.
-- New form submissions land directly in nsh_form_responses from the
-- separate NSH-forms site, so there's no app code path to log them to
-- activity_log -- has to run as a DB trigger (same pattern as
-- add_docent_tour_notification.sql). Once logged, the existing
-- add_activity_log_ntfy_push.sql trigger also pushes a phone notification
-- for it automatically, same as everything else in the Activity Log.
--
-- Requires the pg_net extension (bundled with every Supabase project) --
-- already created by add_docent_tour_notification.sql, but safe to repeat.

create extension if not exists pg_net with schema extensions;

create or replace function log_form_submission_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_title text;
begin
  select title into form_title
  from nsh_forms where id = new.form_id;

  if form_title is null then
    return new;
  end if;

  insert into activity_log (description, action, detail)
  values (
    'New ' || form_title || ' form submitted',
    'form_submission',
    jsonb_build_object('form_id', new.form_id, 'response_id', new.id, 'form_title', form_title)
  );

  return new;
end;
$$;

drop trigger if exists trg_log_form_submission_to_activity on nsh_form_responses;
create trigger trg_log_form_submission_to_activity
  after insert on nsh_form_responses
  for each row execute function log_form_submission_to_activity();
