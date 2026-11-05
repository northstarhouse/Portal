-- Victoria Sedar + Kyle Nicolos Wedding (OCT-03-2027): $800 Initial Payment paid in PayPal
-- (transaction 6E795059JJ264292C, Nov 5, 2026) but never recorded in the Portal.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. Make sure the columns the payment recorder writes exist. If any were missing, the recording step failed
--    after PayPal had already taken the money.
alter table public.venue_payments add column if not exists installment_note text;
alter table public.venue_payments add column if not exists paypal_fee numeric;
alter table public.venue_payments add column if not exists net_amount numeric;

-- 2. Record the payment (skipped if it is already there).
insert into public.venue_payments (inquiry_id, venue_code, amount_cents, currency, paypal_order_id, paypal_capture_id, payer_name, payer_email, installment_note)
select i.id, 'OCT-03-2027', 80000, 'USD', '6E795059JJ264292C', '6E795059JJ264292C', 'Kyle Nicolos', 'nicoloswedding@gmail.com', 'Payment 1 of 4 - Initial Payment'
from public.venue_inquiries i
where i.event_date = '2027-10-03' and i.prebooking_form_response_id is not null and i.name ilike '%sedar%'
on conflict (paypal_capture_id) do nothing;

-- 3. Mark the Initial Payment paid on the schedule (what both the client page and the Portal read).
update public.venue_payment_schedule s
set amount_paid_cents = s.amount_cents, status = 'paid'
from public.venue_inquiries i
where s.inquiry_id = i.id and i.event_date = '2027-10-03' and i.name ilike '%sedar%'
  and s.kind = 'initial' and coalesce(s.amount_paid_cents, 0) < s.amount_cents;

-- 4. Check: should show Initial Payment paid, $800 paid, $5,000 balance.
select s.sequence, s.label, s.amount_cents, s.amount_paid_cents, s.status
from public.venue_payment_schedule s
join public.venue_inquiries i on i.id = s.inquiry_id
where i.event_date = '2027-10-03' and i.name ilike '%sedar%'
order by s.sequence;

-- 5. Other clients who may have been hit the same way: PayPal payments received that no booking has.
select t.transaction_id, t.paid_on, t.gross, t.payer_name, t.payer_email, t.subject
from public.paypal_transactions t
where (t.subject ilike '%venue payment%' or t.items ilike '%venue payment%' or t.note ilike '%venue payment%')
  and not exists (select 1 from public.venue_payments p where p.paypal_capture_id = t.transaction_id)
order by t.occurred_at desc;
