-- Two gaps in the tour -> pre-booking -> client pipeline:
--
-- 1. sync_venue_booking_from_form_response() only ever UPDATEs an existing
--    venue_inquiries row matched by email. If someone booked a tour directly
--    and never went through the general inquiry form, no row exists yet, so
--    their pre-booking submission was silently dropped. Now it creates one.
--
-- 2. Nothing ever generated the venue_payment_schedule rows the Portal/settings
--    already describe (wedding_payment_plan + security_deposit in venue_config).
--    Weddings are a flat $5,000 rental (northstarhouse.org Weddings page), so
--    the schedule is now fully computable the moment a booking is confirmed.

update venue_config
set value = value || jsonb_build_object('rental_total_cents', 500000)
where key = 'wedding_payment_plan';

create or replace function generate_wedding_payment_schedule(p_inquiry_id bigint, p_event_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan jsonb;
  v_deposit jsonb;
  v_initial_cents integer;
  v_total_cents integer;
  v_remaining_cents integer;
  v_running_cents integer := 0;
  v_installment jsonb;
  v_seq integer := 1;
  v_amount_cents integer;
  v_due date;
begin
  if exists (select 1 from venue_payment_schedule where inquiry_id = p_inquiry_id) then
    return;
  end if;

  select value into v_plan from venue_config where key = 'wedding_payment_plan';
  select value into v_deposit from venue_config where key = 'security_deposit';
  if v_plan is null then
    return;
  end if;

  v_initial_cents := coalesce((v_plan->>'initial_amount_cents')::integer, 0);
  v_total_cents := coalesce((v_plan->>'rental_total_cents')::integer, 0);
  v_remaining_cents := greatest(v_total_cents - v_initial_cents, 0);

  insert into venue_payment_schedule (inquiry_id, kind, sequence, label, amount_cents, non_refundable, applies_to_rental, due_date, status)
  values (p_inquiry_id, 'initial', 0, coalesce(v_plan->>'initial_label', 'Initial Payment'), v_initial_cents,
          coalesce((v_plan->>'initial_non_refundable')::boolean, true), true, current_date, 'due');

  if v_deposit is not null then
    insert into venue_payment_schedule (inquiry_id, kind, sequence, label, amount_cents, non_refundable, applies_to_rental, due_date, status)
    values (
      p_inquiry_id, 'security_deposit', 1, 'Refundable Security Deposit', coalesce((v_deposit->>'amount_cents')::integer, 0),
      coalesce((v_deposit->>'refundable')::boolean, true) = false, false,
      case when p_event_date is not null then p_event_date - coalesce((v_deposit->>'due_days_before')::integer, 30) else null end,
      'due'
    );
  end if;

  for v_installment in select * from jsonb_array_elements(coalesce(v_plan->'installments', '[]'::jsonb))
  loop
    v_seq := v_seq + 1;
    v_amount_cents := round(v_remaining_cents * coalesce((v_installment->>'portion')::numeric, 0))::integer;
    v_running_cents := v_running_cents + v_amount_cents;
    v_due := case when p_event_date is not null
      then (p_event_date - (coalesce((v_installment->>'offset_months')::integer, 0) * interval '1 month'))::date
      else null end;
    insert into venue_payment_schedule (inquiry_id, kind, sequence, label, amount_cents, non_refundable, applies_to_rental, due_date, status)
    values (p_inquiry_id, 'installment', v_seq, coalesce(v_installment->>'label', 'Payment'), v_amount_cents, true, true, v_due, 'due');
  end loop;

  -- last-installment-absorbs-remainder: true up any rounding drift onto the final row
  update venue_payment_schedule
  set amount_cents = amount_cents + (v_remaining_cents - v_running_cents)
  where inquiry_id = p_inquiry_id and kind = 'installment'
    and sequence = (select max(sequence) from venue_payment_schedule where inquiry_id = p_inquiry_id and kind = 'installment');
end;
$function$;

create or replace function public.sync_venue_booking_from_form_response()
returns trigger
language plpgsql
as $function$
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
    v_partner_name := new.answers->>'7leui2ic';
    v_email        := new.answers->>'c9u1sxb4';
    v_phone        := new.answers->>'163otrai';
    v_additional   := new.answers->>'cm4d7gip';
    v_event_date   := new.answers->>'sn9urgfr';
    v_event_date_d := nullif(v_event_date, '')::date;
    v_name         := trim(both ' ' from reorder_last_first(v_primary_name) || ' + ' || reorder_last_first(v_partner_name) || ' Wedding');

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
$function$;
