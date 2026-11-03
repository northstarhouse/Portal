-- Tour reminders, scheduled per tour instead of polling.
-- When a tour is booked, two one-time jobs are scheduled just for it: one 24 hours before it starts and one 1 hour before. Each job calls the
-- send-tour-reminders function for that tour only, then removes itself. Move or cancel the tour and its jobs are rescheduled or removed.
-- Run once. It also schedules every tour that is already booked and still ahead.

-- A tour is returned only if it is still booked, the reminder has not gone out, and it starts roughly when the job expected
-- (24h: between 20 and 28 hours away; 1h: within the next 2 hours), so a tour that was moved never gets a stale reminder.
create or replace function public.tour_for_reminder(p_id uuid, p_kind text)
returns setof estate_tours
language sql
stable
as $function$
  select *
  from public.estate_tours t
  where t.id = p_id
    and t.status = 'booked'
    and t.date is not null and t.start_time is not null
    and case p_kind
          when '24h' then t.reminder_24h_sent_at is null
                          and (t.date + t.start_time) at time zone 'America/Los_Angeles' between now() + interval '20 hours' and now() + interval '28 hours'
          when '1h'  then t.reminder_1h_sent_at is null
                          and (t.date + t.start_time) at time zone 'America/Los_Angeles' between now() and now() + interval '2 hours'
          else false
        end
$function$;

-- Runs at the scheduled time: asks the function to send this tour's reminder, then removes its own job.
create or replace function public.fire_tour_reminder(p_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public, cron, net
as $function$
begin
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-tour-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := jsonb_build_object('tour_id', p_id, 'kind', p_kind),
    timeout_milliseconds := 60000);
  perform cron.unschedule('tour-reminder-' || p_kind || '-' || p_id::text);
exception when others then
  -- never leave the job behind to fire again next year
  begin perform cron.unschedule('tour-reminder-' || p_kind || '-' || p_id::text); exception when others then null; end;
end
$function$;

-- (Re)schedules one tour's two reminders from its current date and time. A tour that is not booked has none.
create or replace function public.schedule_tour_reminders(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, cron
as $function$
declare
  t estate_tours;
  kind text;
  hrs numeric;
  fire timestamptz;
  v_job text;
begin
  for kind, hrs in select * from (values ('24h', 24::numeric), ('1h', 1::numeric)) v loop
    v_job := 'tour-reminder-' || kind || '-' || p_id::text;
    if exists (select 1 from cron.job where jobname = v_job) then perform cron.unschedule(v_job); end if;
  end loop;

  select * into t from public.estate_tours where id = p_id;
  if not found or t.status <> 'booked' or t.date is null or t.start_time is null then return; end if;

  for kind, hrs in select * from (values ('24h', 24::numeric), ('1h', 1::numeric)) v loop
    if (kind = '24h' and t.reminder_24h_sent_at is not null) or (kind = '1h' and t.reminder_1h_sent_at is not null) then continue; end if;
    fire := ((t.date + t.start_time) at time zone 'America/Los_Angeles') - make_interval(hours => hrs::int);
    if fire <= now() + interval '1 minute' then continue; end if; -- already too late for this one
    v_job := 'tour-reminder-' || kind || '-' || p_id::text;
    perform cron.schedule(v_job,
      format('%s %s %s %s *', extract(minute from fire at time zone 'UTC')::int, extract(hour from fire at time zone 'UTC')::int,
             extract(day from fire at time zone 'UTC')::int, extract(month from fire at time zone 'UTC')::int),
      format('select public.fire_tour_reminder(%L::uuid, %L)', p_id, kind));
  end loop;
end
$function$;

create or replace function public.estate_tours_schedule_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.schedule_tour_reminders(new.id);
  return new;
end
$function$;

drop trigger if exists trg_estate_tours_schedule_reminders on public.estate_tours;
create trigger trg_estate_tours_schedule_reminders
  after insert or update of status, date, start_time on public.estate_tours
  for each row execute function public.estate_tours_schedule_reminders();

-- Schedule every tour that is already booked and still ahead.
select public.schedule_tour_reminders(id) from public.estate_tours
where status = 'booked' and date >= (now() at time zone 'America/Los_Angeles')::date;
