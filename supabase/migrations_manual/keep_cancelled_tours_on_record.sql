-- Run once in the Supabase SQL editor.
-- A cancelled tour now stays on the upcoming list marked "Cancelled", and its time is offered again as a new open slot.
-- So Jen's one-row-per-time rule must ignore cancelled rows, and the nightly slot refill must match that rule.
drop index if exists estate_tours_jen_slot_idx;
create unique index estate_tours_jen_slot_idx
  on estate_tours (date, start_time)
  where guide_name = 'Jen' and status <> 'cancelled';

create or replace function public.ensure_default_tour_slots()
returns void
language plpgsql
as $function$
declare
  d date := current_date;
  horizon date := current_date + interval '8 weeks';
  t time;
begin
  while d <= horizon loop
    if extract(dow from d) in (1, 2, 4) then -- Mon, Tue, Thu
      foreach t in array array['09:00','10:00','11:00','12:00']::time[] loop
        insert into public.estate_tours (date, start_time, guide_name, status)
        select d, t, 'Jen', 'open'
        where not exists (
          select 1 from public.estate_tours
          where date = d and start_time = t and status in ('open', 'blocked', 'booked')
        )
        on conflict (date, start_time) where guide_name = 'Jen' and status <> 'cancelled' do nothing;
      end loop;
    end if;
    d := d + 1;
  end loop;
end;
$function$;
