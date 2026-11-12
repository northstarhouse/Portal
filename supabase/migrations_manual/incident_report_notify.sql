-- Incident Report form: every new submission is emailed (branded, with every question and answer, grouped by section)
-- to the board members (board_members table), media@ and info@. The questions are read from the form itself, so edits
-- to the form in Form Builder show up in the email automatically.
-- Apply one statement at a time.

CREATE OR REPLACE FUNCTION public.notify_incident_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  form_fields jsonb;
  f jsonb;
  v jsonb;
  ans text;
  cur_section text := null;
  rows_html text := '';
  text_body text := '';
  html text;
  recipients text[];
  who text;
  when_txt text;
  esc_ans text;
begin
  if new.form_id <> '155bc315-fff1-428d-8b1b-34528b82b525' then
    return new;
  end if;

  select fields into form_fields from nsh_forms where id = new.form_id;

  for f in select * from jsonb_array_elements(coalesce(form_fields, '[]'::jsonb)) loop
    v := new.answers -> (f->>'id');
    if v is null or v = 'null'::jsonb then
      ans := '';
    elsif jsonb_typeof(v) = 'array' then
      select string_agg(x, ', ') into ans from jsonb_array_elements_text(v) x;
    elsif jsonb_typeof(v) = 'boolean' then
      ans := case when v::text = 'true' then 'Yes' else 'No' end;
    else
      ans := v #>> '{}';
    end if;
    ans := coalesce(nullif(trim(ans), ''), '—');
    esc_ans := replace(replace(replace(ans, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

    if coalesce(f->>'section', '') <> coalesce(cur_section, '') then
      cur_section := coalesce(f->>'section', '');
      if cur_section <> '' then
        rows_html := rows_html || '<tr><td colspan="2" style="padding:22px 0 6px;font-family:Georgia,''Times New Roman'',serif;font-size:18px;color:#886c44;border-bottom:1px solid #e5ddcf;">'
          || replace(replace(cur_section, '&', '&amp;'), '<', '&lt;') || '</td></tr>';
        text_body := text_body || E'\n\n== ' || cur_section || E' ==';
      end if;
    end if;

    rows_html := rows_html || '<tr>'
      || '<td style="padding:8px 12px 8px 0;vertical-align:top;width:42%;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#777;border-bottom:1px solid #f1ece3;">'
      || replace(replace(coalesce(f->>'label', ''), '&', '&amp;'), '<', '&lt;') || '</td>'
      || '<td style="padding:8px 0;vertical-align:top;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#2a2420;border-bottom:1px solid #f1ece3;white-space:pre-wrap;">'
      || esc_ans || '</td></tr>';
    text_body := text_body || E'\n' || coalesce(f->>'label', '') || ': ' || ans;
  end loop;

  who := coalesce(nullif(trim(new.answers->>'ir_name'), ''), 'Someone');
  when_txt := coalesce(nullif(new.answers->>'ir_date', ''), 'an unknown date');

  select array_agg(distinct lower(trim(email))) into recipients
  from (
    select email from board_members where email is not null and trim(email) <> ''
    union all select 'media@thenorthstarhouse.org'
    union all select 'info@thenorthstarhouse.org'
  ) r;

  text_body := 'New Incident Report' || E'\n\n' || who || ' reported an incident on ' || when_txt || '.' || text_body
    || E'\n\nView all responses in the Portal: https://northstarhouse.github.io/Portal/#form-responses';

  html := '<div style="background:#d9cdb8;padding:32px 16px;font-family:Georgia,''Times New Roman'',serif;">'
    || '<div style="max-width:620px;margin:0 auto;background:#fdfbf7;border-radius:2px;overflow:hidden;">'
    || '<div style="height:14px;background:#886c44;"></div>'
    || '<div style="padding:40px 36px 32px;">'
    || '<div style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#886c44;margin-bottom:10px;">North Star House</div>'
    || '<h1 style="margin:0 0 18px;font-size:30px;font-weight:400;color:#2a2420;text-align:center;">New Incident Report</h1>'
    || '<div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 18px;"></div>'
    || '<p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.5;text-align:center;"><b>'
    || replace(replace(who, '&', '&amp;'), '<', '&lt;') || '</b> reported an incident on <b>' || replace(when_txt, '<', '&lt;') || '</b>.</p>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 28px;">' || rows_html || '</table>'
    || '<div style="text-align:center;"><a href="https://northstarhouse.github.io/Portal/#form-responses" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:6px;">View in the Portal</a></div>'
    || '</div></div></div>';

  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := jsonb_build_object(
      'to', to_jsonb(recipients),
      'subject', 'Incident Report: ' || when_txt || ' (' || who || ')',
      'body', text_body,
      'html', html
    )
  );

  return new;
end;
$function$;

drop trigger if exists trg_notify_incident_report on public.nsh_form_responses;

create trigger trg_notify_incident_report after insert on public.nsh_form_responses for each row execute function public.notify_incident_report();
