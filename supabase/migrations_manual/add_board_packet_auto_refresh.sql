-- Run this once in the Supabase SQL editor.
-- Auto-generates each month's Board Packet PDF (merge-meeting-packet,
-- saved into "Meeting & Board Reports/<Month Year>") starting 3 days
-- before that month's meeting (always the third Thursday) and keeps it
-- refreshed through the meeting day itself -- via a daily cron check plus
-- an instant trigger whenever a report is added/changed during that
-- window, so staff never have to click "View / Download Full Packet"
-- just to get it saved to Drive; the button still works for on-demand
-- regeneration/viewing at any time, including for archived months.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function third_thursday(month_key text)
returns date
language plpgsql
as $$
declare
  first_day date := to_date(month_key || '-01', 'YYYY-MM-DD');
  dow int := extract(dow from first_day)::int; -- 0=Sun..6=Sat
  first_thursday int := 1 + ((4 - dow + 7) % 7);
begin
  return first_day + (first_thursday - 1 + 14);
end;
$$;

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
        when 'Docents' then 3
        when 'Grounds' then 4
        when 'Planning' then 5
        when 'Events' then 6
        when 'Development' then 7
        else 8
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

-- Daily safety net: catches any month currently inside its "3 days before
-- the meeting through the meeting day" window and (re)generates its packet.
create or replace function refresh_upcoming_board_packets()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  today date := current_date;
  cursor_month date;
  month_key text;
  meeting date;
begin
  for cursor_month in
    select generate_series(date_trunc('month', today) - interval '1 month', date_trunc('month', today) + interval '1 month', interval '1 month')::date
  loop
    month_key := to_char(cursor_month, 'YYYY-MM');
    meeting := third_thursday(month_key);
    if today between (meeting - 3) and meeting then
      perform refresh_board_packet_for_month(month_key);
    end if;
  end loop;
end;
$$;

select cron.schedule('refresh-board-packets-daily', '0 13 * * *', $$select refresh_upcoming_board_packets();$$);

-- Instant refresh whenever a report lands during that same window, instead
-- of waiting for the next day's cron tick.
create or replace function trg_refresh_board_packet_on_report_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  month_key text;
  meeting date;
  today date := current_date;
begin
  if new.meeting_date is null then
    return new;
  end if;
  month_key := to_char(new.meeting_date, 'YYYY-MM');
  meeting := third_thursday(month_key);
  if today between (meeting - 3) and meeting then
    perform refresh_board_packet_for_month(month_key);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_meeting_board_reports_refresh_packet on meeting_board_reports;
create trigger trg_meeting_board_reports_refresh_packet
  after insert or update on meeting_board_reports
  for each row execute function trg_refresh_board_packet_on_report_change();
