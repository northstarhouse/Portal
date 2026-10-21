-- Newly auto-generated open tour slots were landing under the generic
-- 'default' guide with no name shown, while the existing schedule is all
-- Jen's. Attribute new slots to Jen directly and relabel the 17 that already
-- came in unassigned, so the schedule reads consistently.

update estate_tours
set guide_name = 'Jen'
where guide_name = 'default' and status = 'open';

-- One pre-existing stray: a phantom 'open' Jen slot sitting at the exact
-- same date/time as an already-booked Jen tour (2026-11-12 11:00, id
-- c8249746-a2db-4a13-a541-c82c82abeab7) -- found only once the new unique
-- index below caught it. Deleted since the booked row already serves that
-- slot and the open duplicate should never have existed.
delete from estate_tours where id = 'c8249746-a2db-4a13-a541-c82c82abeab7' and status = 'open' and guide_name = 'Jen' and date = '2026-11-12' and start_time = '11:00:00';

drop index if exists estate_tours_default_slot_idx;
create unique index estate_tours_jen_slot_idx
  on estate_tours (date, start_time)
  where guide_name = 'Jen';

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
        on conflict (date, start_time) where guide_name = 'Jen' do nothing;
      end loop;
    end if;
    d := d + 1;
  end loop;
end;
$function$;
