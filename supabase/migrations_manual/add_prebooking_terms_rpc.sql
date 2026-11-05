-- Lets the public pre-booking form show a client the price and security deposit the venue team set for them.
-- The form link carries a random id (prebooking_manual_sends.id); this returns only that send's amounts.
-- Nothing else about the send (email, name, notes) is exposed. Safe to re-run.

create or replace function public.prebooking_terms(p_send uuid)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select json_build_object('price_cents', s.custom_price_cents, 'deposit_cents', s.custom_deposit_cents)
  from prebooking_manual_sends s
  where s.id = p_send and (s.custom_price_cents is not null or s.custom_deposit_cents is not null);
$$;

revoke all on function public.prebooking_terms(uuid) from public;
grant execute on function public.prebooking_terms(uuid) to anon, authenticated;
