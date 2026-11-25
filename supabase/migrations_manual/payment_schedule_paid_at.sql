-- Remember the day each scheduled payment was paid, so the client timeline can say "Paid: Nov 5".
-- New: paid_at is stamped when a row becomes paid. Existing paid rows are filled from the matching online payment
-- (same amount, else the first payment on that booking). Safe to re-run.
create or replace function public.trg_schedule_paid_at() returns trigger language plpgsql as $$
begin
  if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
  return new;
end $$;
drop trigger if exists schedule_paid_at on public.venue_payment_schedule;
create trigger schedule_paid_at before insert or update of status on public.venue_payment_schedule
  for each row execute function public.trg_schedule_paid_at();

update public.venue_payment_schedule s set paid_at = coalesce(
  (select min(p.created_at) from public.venue_payments p where p.inquiry_id = s.inquiry_id and p.amount_cents = s.amount_cents),
  (select min(p.created_at) from public.venue_payments p where p.inquiry_id = s.inquiry_id))
where s.status = 'paid' and s.paid_at is null;
