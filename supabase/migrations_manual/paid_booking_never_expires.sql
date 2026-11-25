-- Once a deposit (or any payment) is in, the date is booked: the agreement never "expires" and the soft hold is never released
-- because a signature is still missing. venue_response_paid() is true when the pre-booking has a payment online, on the payment
-- schedule, or logged by hand. The expiry step in venue_agreement_action skips paid bookings. Safe to re-run.
create or replace function public.venue_response_paid(p_rid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.venue_inquiries i
    where i.prebooking_form_response_id = p_rid
      and (
        exists (select 1 from public.venue_payments p where p.inquiry_id = i.id and coalesce(p.amount_cents, 0) > 0)
        or exists (select 1 from public.venue_payment_schedule s where s.inquiry_id = i.id and coalesce(s.amount_paid_cents, 0) > 0)
      )
  ) or exists (
    select 1 from public.nsh_form_responses f, jsonb_array_elements(
      case when jsonb_typeof(f.answers #> '{__venue_checklist,manual_payments}') = 'array' then f.answers #> '{__venue_checklist,manual_payments}' else '[]'::jsonb end
    ) m
    where f.id = p_rid and coalesce((m ->> 'cents')::numeric, 0) > 0
  );
$$;
