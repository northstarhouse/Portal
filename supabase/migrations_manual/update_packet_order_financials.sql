-- Run this once in the Supabase SQL editor.
-- Updates refresh_board_packet_for_month's category ordering to include the
-- new "Financials" category (between Previous Minutes and Docents),
-- matching the Portal UI's card order.

create or replace function refresh_board_packet_for_month(month_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  month_label text;
  files_json jsonb;
begin
  month_label := to_char(to_date(month_key || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY');

  select coalesce(jsonb_agg(jsonb_build_object(
      'fileId', (regexp_match(r.url, '/file/d/([^/]+)'))[1],
      'title', r.title,
      'category', coalesce(r.category, 'Custom')
    ) order by
      case coalesce(r.category, 'Custom')
        when 'Agenda' then 1
        when 'Previous Minutes' then 2
        when 'Financials' then 3
        when 'Docents' then 4
        when 'Grounds' then 5
        when 'Planning' then 6
        when 'Events' then 7
        when 'Development' then 8
        else 9
      end,
      r.created_at
  ), '[]'::jsonb)
  into files_json
  from meeting_board_reports r
  where r.url ~ '/file/d/'
    and to_char(r.meeting_date, 'YYYY-MM') = month_key;

  if files_json is null or jsonb_array_length(files_json) = 0 then
    return;
  end if;

  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/merge-meeting-packet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do',
      'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'
    ),
    body := jsonb_build_object('monthLabel', month_label, 'files', files_json),
    timeout_milliseconds := 30000
  );
end;
$$;
