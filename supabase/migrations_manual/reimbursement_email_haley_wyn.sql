-- When a volunteer submits a reimbursement request through the Volunteer Hub, email Haley and Wyn.
-- The Hub records a "reimbursement_submitted" activity entry right after the request (and its receipt) is saved, so the email
-- is sent from that moment. In-kind donations logged through the Hub use a different action and do not email. Safe to re-run.
create or replace function public.trg_reimbursement_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  recips text[];
  v_name text;
  v_amt text;
  v_desc text;
  v_event text;
  v_html text;
  v_text text;
  v_link text := 'https://northstarhouse.github.io/Portal/#financials';
begin
  if new.action is distinct from 'reimbursement_submitted' then return new; end if;

  select * into r from public."Op Budget"
   where needs_reimbursement is true and volunteer_id is not distinct from new.volunteer_id
   order by coalesce(submitted_at, created_at) desc limit 1;

  select array_agg(distinct lower(trim("Email"))) into recips
    from public."2026 Volunteers"
   where (("First Name" = 'Haley' and "Last Name" = 'Wright') or ("First Name" = 'Wyn' and "Last Name" = 'Spiller'))
     and nullif(trim("Email"), '') is not null;
  if recips is null or array_length(recips, 1) is null then return new; end if;

  v_name := coalesce(nullif(trim(r.volunteer_name), ''), nullif(trim(new.volunteer_name), ''), 'A volunteer');
  v_amt := case when r.amount is not null then to_char(r.amount, 'FM999,999,990.00') else null end;
  v_desc := coalesce(nullif(trim(r.description), ''), new.description);
  v_event := nullif(trim(coalesce(r.event_name, '')), '');

  v_text := v_name || ' submitted a reimbursement request' || coalesce(' for $' || v_amt, '') || E'.\n\n'
    || coalesce('What: ' || v_desc || E'\n', '')
    || coalesce('Area: ' || r.area || coalesce(' · ' || v_event, '') || E'\n', '')
    || coalesce('Purchase date: ' || r.date::text || E'\n', '')
    || case when coalesce(r.receipt_url, '') <> '' then E'Receipt: attached\n' else E'Receipt: none attached\n' end
    || E'\nReview it, then Approve, Request Info or Deny: ' || v_link;

  v_html := '<div style="font-family:Georgia,serif;background:#f6f1e7;padding:24px">'
    || '<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6dfd3;border-top:4px solid #886c44;border-radius:10px;padding:28px">'
    || '<div style="font-size:12px;letter-spacing:.12em;color:#886c44;font-weight:700">NORTH STAR HOUSE</div>'
    || '<h2 style="margin:8px 0 14px;font-size:22px;color:#2c2418">New reimbursement request</h2>'
    || '<p style="font-family:system-ui,sans-serif;color:#3a3226;line-height:1.5;margin:0 0 14px"><b>' || replace(replace(replace(v_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> submitted a request' || coalesce(' for <b>$' || v_amt || '</b>', '') || '.</p>'
    || '<table style="font-family:system-ui,sans-serif;font-size:14px;color:#3a3226;border-collapse:collapse;width:100%">'
    || coalesce('<tr><td style="padding:6px 0;color:#8a7e6b;width:120px">What</td><td style="padding:6px 0">' || replace(replace(replace(v_desc, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</td></tr>', '')
    || coalesce('<tr><td style="padding:6px 0;color:#8a7e6b">Area</td><td style="padding:6px 0">' || replace(replace(replace(r.area || coalesce(' · ' || v_event, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</td></tr>', '')
    || coalesce('<tr><td style="padding:6px 0;color:#8a7e6b">Purchase date</td><td style="padding:6px 0">' || r.date::text || '</td></tr>', '')
    || '<tr><td style="padding:6px 0;color:#8a7e6b">Receipt</td><td style="padding:6px 0">' || case when coalesce(r.receipt_url, '') <> '' then 'Attached' else 'None attached' end || '</td></tr>'
    || '</table>'
    || '<p style="margin:20px 0 0"><a href="' || v_link || '" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;padding:11px 22px;border-radius:8px">Review in the Portal</a></p>'
    || '</div></div>';

  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := jsonb_build_object('to', to_jsonb(recips), 'subject', 'New reimbursement request: ' || v_name || coalesce(' ($' || v_amt || ')', ''), 'body', v_text, 'html', v_html),
    timeout_milliseconds := 20000
  );
  return new;
exception when others then
  return new; -- never block the Hub's activity log because of an email problem
end;
$$;

drop trigger if exists reimbursement_email on public.activity_log;
create trigger reimbursement_email after insert on public.activity_log
  for each row execute function public.trg_reimbursement_email();
