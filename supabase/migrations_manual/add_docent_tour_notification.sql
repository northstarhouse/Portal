-- Run this once in the Supabase SQL editor.
-- Emails the active Docents team (Team or Event Tags containing "Docent",
-- Status = Active in "2026 Volunteers") whenever someone submits the public
-- "Docent Tour Form" (id 0635cd26-b0c7-4076-b9b1-bd25d1949467), using the
-- same NSH branded email look as buildBoardNotificationEmailHtml in
-- src/app.jsx. Submissions land directly in nsh_form_responses from the
-- separate NSH-forms site, so this has to run as a DB trigger rather than
-- app code -- same pattern as add_activity_log_ntfy_push.sql.
--
-- Requires the pg_net extension (bundled with every Supabase project).

create extension if not exists pg_net with schema extensions;

create or replace function notify_docents_on_tour_request()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  docent_emails text[];
  requester_name text;
  requester_email text;
  preferred_dates text;
  participant_count text;
  notes text;
  html text;
  text_body text;
begin
  -- Only the Docent Tour Form
  if new.form_id <> '0635cd26-b0c7-4076-b9b1-bd25d1949467' then
    return new;
  end if;

  select array_agg(distinct "Email") into docent_emails
  from "2026 Volunteers"
  where "Email" is not null and trim("Email") <> ''
    and lower(coalesce("Status", '')) = 'active'
    and ("Team" ilike '%docent%' or "Event Tags" ilike '%docent%');

  if docent_emails is null or array_length(docent_emails, 1) = 0 then
    return new;
  end if;

  requester_name := trim(coalesce(new.answers->>'dt_first', '') || ' ' || coalesce(new.answers->>'dt_last', ''));
  requester_email := coalesce(new.answers->>'dt_email', '');
  preferred_dates := coalesce(nullif(new.answers->>'dt_dates', ''), 'Not specified');
  participant_count := coalesce(nullif(new.answers->>'dt_count', ''), 'Not specified');
  notes := coalesce(new.answers->>'dt_notes', '');

  text_body := 'New Docent Tour Request'
    || E'\n\nFrom: ' || requester_name || ' <' || requester_email || '>'
    || E'\nPreferred dates: ' || preferred_dates
    || E'\nParticipants: ' || participant_count
    || (case when notes <> '' then E'\nNotes: ' || notes else '' end)
    || E'\n\nView in Portal: https://northstarhouse.github.io/Portal/';

  html := '<div style="background:#d9cdb8;padding:32px 16px;font-family:Georgia,''Times New Roman'',serif;">' ||
    '<div style="max-width:560px;margin:0 auto;background:#fdfbf7;border-radius:2px;overflow:hidden;">' ||
      '<div style="height:14px;background:#886c44;"></div>' ||
      '<div style="padding:48px 40px 32px;text-align:center;">' ||
        '<h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">New Docent Tour Request</h1>' ||
        '<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>' ||
        '<p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.5;"><b>' || requester_name || '</b> requested a tour.</p>' ||
        '<p style="margin:0 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#777;line-height:1.6;text-align:left;display:inline-block;">' ||
          'Preferred dates: ' || preferred_dates || '<br/>' ||
          'Participants: ' || participant_count ||
          (case when notes <> '' then '<br/>Notes: ' || notes else '' end) ||
        '</p><br/>' ||
        '<a href="https://northstarhouse.github.io/Portal/" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:16px;padding:16px 32px;border-radius:6px;margin-bottom:8px;">View in Portal</a>' ||
      '</div>' ||
    '</div>' ||
  '</div>';

  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := jsonb_build_object(
      'to', to_jsonb(docent_emails),
      'subject', 'New Docent Tour Request',
      'body', text_body,
      'html', html
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_docents_on_tour_request on nsh_form_responses;
create trigger trg_notify_docents_on_tour_request
  after insert on nsh_form_responses
  for each row execute function notify_docents_on_tour_request();
