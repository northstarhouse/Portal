-- Chamber newsletter submission: an automatic to-do for Haley on every upcoming committee event.
-- The Grass Valley Chamber newsletter runs about two weeks before an event, so it has to be sent in on the Monday two Mondays
-- before the event (Mondays strictly before the event date; an event on a Monday counts back a full week for the first one).
-- Example: event Saturday Dec 12, 2026 -> Mondays before: Dec 7, Nov 30 -> send in by Nov 30.
--
-- The task is a normal checklist item (id 'chamber-news', category Marketing, assigned to Haley Wright, volunteer id 22), so it shows
-- on the event's checklist and on her "My Event Tasks" list on the dashboard. Safe to re-run.
--   * new event with a date: the task is added (if its due date is still ahead)
--   * date set for the first time, or changed: the task is added / its due date moved (while it is not done)
--   * deleted by hand: it stays deleted until the date changes
-- Cancelled and completed events are left alone.

create or replace function public.chamber_submit_date(p_event_date date)
returns date
language sql
immutable
as $$
  select p_event_date - (case when extract(isodow from p_event_date)::int = 1 then 7 else extract(isodow from p_event_date)::int - 1 end) - 7;
$$;

create or replace function public.trg_chamber_newsletter_task()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_due date;
  v_item jsonb;
  v_list jsonb;
  v_has boolean;
begin
  if new.date is null or new.status in ('cancelled', 'completed') then return new; end if;
  v_due := chamber_submit_date(new.date);
  v_list := coalesce(new.checklist, '[]'::jsonb);
  select exists (select 1 from jsonb_array_elements(v_list) e where e->>'id' = 'chamber-news') into v_has;

  if v_has then
    -- date changed: move the due date, unless the task is already done
    if tg_op = 'UPDATE' and old.date is distinct from new.date then
      select coalesce(jsonb_agg(case when e->>'id' = 'chamber-news' and coalesce((e->>'done')::boolean, false) = false
                                     then jsonb_set(e, '{due}', to_jsonb(v_due::text)) else e end), '[]'::jsonb)
        into v_list from jsonb_array_elements(v_list) e;
      new.checklist := v_list;
    end if;
  elsif v_due >= current_date and (tg_op = 'INSERT' or old.date is null or old.date is distinct from new.date) then
    v_item := jsonb_build_object(
      'id', 'chamber-news',
      'text', 'Send in to the Grass Valley Chamber Newsletter',
      'category', 'Marketing', 'done', false, 'due', v_due::text,
      'assignee', 'Haley Wright', 'assigneeId', 22, 'assignedIds', jsonb_build_array(22), 'people', '[]'::jsonb,
      'estimated', 0, 'actual', 0, 'priority', '',
      'notes', 'Added automatically. The newsletter runs about two weeks before the event, so it goes in on the Monday two Mondays before. Use Draft email on the Grass Valley Chamber Newsletter channel in Marketing.');
    new.checklist := v_list || jsonb_build_array(v_item);
  end if;
  return new;
end;
$function$;

drop trigger if exists chamber_newsletter_task on public.events_committee;
create trigger chamber_newsletter_task
  before insert or update of date on public.events_committee
  for each row execute function public.trg_chamber_newsletter_task();

-- One-time: add it to the events already on the calendar whose send-in date is still ahead.
update public.events_committee e
   set checklist = coalesce(e.checklist, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'chamber-news',
      'text', 'Send in to the Grass Valley Chamber Newsletter',
      'category', 'Marketing', 'done', false, 'due', chamber_submit_date(e.date)::text,
      'assignee', 'Haley Wright', 'assigneeId', 22, 'assignedIds', jsonb_build_array(22), 'people', '[]'::jsonb,
      'estimated', 0, 'actual', 0, 'priority', '',
      'notes', 'Added automatically. The newsletter runs about two weeks before the event, so it goes in on the Monday two Mondays before. Use Draft email on the Grass Valley Chamber Newsletter channel in Marketing.'))
 where e.date is not null and e.status not in ('cancelled', 'completed')
   and chamber_submit_date(e.date) >= current_date
   and not exists (select 1 from jsonb_array_elements(coalesce(e.checklist, '[]'::jsonb)) x where x->>'id' = 'chamber-news');
