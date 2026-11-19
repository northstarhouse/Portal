-- Extra rental hours added from the client page ("Add extra hours to your rental day") are their own payment rows.
alter table public.venue_payment_schedule drop constraint if exists venue_payment_schedule_kind_check;
alter table public.venue_payment_schedule add constraint venue_payment_schedule_kind_check
  check (kind = any (array['initial'::text, 'installment'::text, 'rehearsal'::text, 'security_deposit'::text, 'extra_hours'::text]));
