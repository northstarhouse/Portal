-- When a client submits the events pre-booking form ("Pre Booking Information Form (Events)"), link it to a booking record
-- automatically, the way the wedding form already does. Without a linked booking the client's venue code does not work.
--   * an existing non-wedding inquiry with the same email that has no pre-booking form yet is updated (date, status Booking, linked)
--   * otherwise a new Private Event booking is created
-- Linking (re)builds the custom payment schedule through the existing custom_schedule_on_prebooking trigger when the team sent
-- a custom price. Never blocks the form: any error is logged as a warning only. Safe to re-run.

create or replace function public.sync_event_booking_from_form_response()
returns trigger
language plpgsql
as $function$
declare
  v_email text;
  v_date date;
  v_name text;
  v_inq bigint;
begin
  if new.form_id <> '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'::uuid then
    return new;
  end if;
  begin
    if exists (select 1 from venue_inquiries where prebooking_form_response_id = new.id) then return new; end if;
    v_email := lower(trim(coalesce(new.answers->>'evp_email', '')));
    v_date  := nullif(new.answers->>'evp_date', '')::date;
    v_name  := coalesce(nullif(trim(new.answers->>'__event_name'), ''), nullif(trim(new.answers->>'evp_org'), ''), nullif(trim(new.answers->>'evp_name'), ''), 'Event');
    if v_date is null then return new; end if;

    select id into v_inq from venue_inquiries
    where v_email <> '' and lower(email) = v_email and prebooking_form_response_id is null and coalesce(event_type, '') not ilike 'wedding%'
    order by created_at desc limit 1;

    if v_inq is not null then
      update venue_inquiries set event_date = v_date, status = 'Booking', prebooking_form_response_id = new.id where id = v_inq;
    else
      insert into venue_inquiries (name, email, phone, event_type, event_date, status, source, prebooking_form_response_id)
      values (v_name, nullif(v_email, ''), new.answers->>'evp_phone', 'Private Event', v_date, 'Booking', 'website', new.id);
    end if;
  exception when others then
    raise warning 'sync_event_booking_from_form_response failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_sync_event_booking on public.nsh_form_responses;
create trigger trg_sync_event_booking after insert on public.nsh_form_responses
  for each row execute function public.sync_event_booking_from_form_response();
