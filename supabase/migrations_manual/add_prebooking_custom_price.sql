-- Custom price and security deposit set by the venue team when they send a pre-booking form by hand
-- (Venue Rentals > Send out a pre-booking form). Safe to re-run.
--
-- When that client's event booking is linked to their submitted pre-booking form, these become their payment schedule,
-- so the agreement and the client page show the pricing. (Weddings keep the standard $5,000 plan, which is generated
-- separately, so this only applies to other event types.)

alter table public.prebooking_manual_sends add column if not exists custom_price_cents integer;
alter table public.prebooking_manual_sends add column if not exists custom_deposit_cents integer;

create or replace function public.generate_custom_payment_schedule(p_inquiry_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inq venue_inquiries%rowtype;
  v_form_email text;
  v_send prebooking_manual_sends%rowtype;
  v_seq integer := 0;
begin
  select * into v_inq from venue_inquiries where id = p_inquiry_id;
  if not found then return; end if;
  if coalesce(v_inq.event_type, '') ilike 'wedding%' then return; end if;
  if exists (select 1 from venue_payment_schedule where inquiry_id = p_inquiry_id) then return; end if;

  -- The email they used on the form may differ from the one on the inquiry, so try both.
  select lower(trim(coalesce(r.answers->>'evp_email', r.answers->>'c9u1sxb4', ''))) into v_form_email
  from nsh_form_responses r where r.id = v_inq.prebooking_form_response_id;

  select * into v_send
  from prebooking_manual_sends s
  where (s.custom_price_cents is not null or s.custom_deposit_cents is not null)
    and (lower(s.email) = lower(coalesce(v_inq.email, '')) or (v_form_email <> '' and lower(s.email) = v_form_email))
  order by s.sent_at desc
  limit 1;
  if not found then return; end if;

  -- Rental fee: due 90 days before the event, or on booking if the event is closer than that (agreement section 2).
  if v_send.custom_price_cents is not null then
    insert into venue_payment_schedule (inquiry_id, kind, sequence, label, amount_cents, non_refundable, applies_to_rental, due_date, status)
    values (p_inquiry_id, 'initial', v_seq, 'Venue Rental Fee', v_send.custom_price_cents, true, true,
            case when v_inq.event_date is not null then greatest(current_date, v_inq.event_date - 90) else current_date end, 'due');
    v_seq := v_seq + 1;
  end if;

  -- Refundable security deposit: due 30 days before the event.
  if v_send.custom_deposit_cents is not null then
    insert into venue_payment_schedule (inquiry_id, kind, sequence, label, amount_cents, non_refundable, applies_to_rental, due_date, status)
    values (p_inquiry_id, 'security_deposit', v_seq, 'Refundable Security Deposit', v_send.custom_deposit_cents, false, false,
            case when v_inq.event_date is not null then greatest(current_date, v_inq.event_date - 30) else null end, 'due');
  end if;
end;
$function$;

create or replace function public.trg_custom_schedule_on_prebooking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform generate_custom_payment_schedule(new.id);
  exception when others then
    raise warning 'generate_custom_payment_schedule failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

drop trigger if exists custom_schedule_on_prebooking on public.venue_inquiries;
create trigger custom_schedule_on_prebooking
  after insert or update of prebooking_form_response_id, event_date on public.venue_inquiries
  for each row
  when (new.prebooking_form_response_id is not null and coalesce(new.event_type, '') not ilike 'wedding%')
  execute function public.trg_custom_schedule_on_prebooking();
