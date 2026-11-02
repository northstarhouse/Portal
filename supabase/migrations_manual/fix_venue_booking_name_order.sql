-- Booking names use the names as entered ("Victoria Sedar + Kyle Nicolos Wedding"), no longer flipped to last-first.
CREATE OR REPLACE FUNCTION public.sync_venue_booking_from_form_response()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_primary_name text;
  v_partner_name text;
  v_email text;
  v_phone text;
  v_additional text;
  v_event_date text;
  v_event_date_d date;
  v_inquiry_id bigint;
  v_name text;
begin
  if new.form_id <> 'a3a383f7-e1db-4344-9dec-ea879ad3406d'::uuid then
    return new;
  end if;

  begin
    v_primary_name := new.answers->>'7fnabd0i';
    v_partner_name := nullif(trim(coalesce(new.answers->>'7leui2ic', '')), '');
    v_email        := new.answers->>'c9u1sxb4';
    v_phone        := new.answers->>'163otrai';
    v_additional   := new.answers->>'cm4d7gip';
    v_event_date   := new.answers->>'sn9urgfr';
    v_event_date_d := nullif(v_event_date, '')::date;
    v_name         := trim(both ' ' from trim(v_primary_name)
                      || case when v_partner_name is not null then ' + ' || trim(v_partner_name) else '' end
                      || ' Wedding');

    select id into v_inquiry_id
    from venue_inquiries
    where lower(email) = lower(v_email)
    order by created_at desc
    limit 1;

    if v_inquiry_id is not null then
      update venue_inquiries set
        name = v_name,
        partner_name = v_partner_name,
        phone = coalesce(v_phone, phone),
        additional_contacts = v_additional,
        event_date = v_event_date_d,
        status = 'Booking',
        prebooking_form_response_id = new.id
      where id = v_inquiry_id;
    else
      -- No prior inquiry (e.g. they only ever booked a tour) -- create one
      -- directly from the pre-booking form instead of dropping it silently.
      insert into venue_inquiries (name, email, phone, partner_name, additional_contacts, event_type, event_date, status, source, prebooking_form_response_id)
      values (v_name, v_email, v_phone, v_partner_name, v_additional, 'Wedding', v_event_date_d, 'Booking', 'website', new.id)
      returning id into v_inquiry_id;
    end if;

    if v_inquiry_id is not null then
      perform generate_wedding_payment_schedule(v_inquiry_id, v_event_date_d);
    end if;
  exception when others then
    raise warning 'sync_venue_booking_from_form_response failed: %', sqlerrm;
  end;

  return new;
end;
$function$
