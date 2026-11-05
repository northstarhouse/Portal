-- Molly Burton + Waylon Spence Wedding (May 1, 2027, booking id 52).
-- Her payment showed "This payment does not match the venue code entered". PayPal may have taken the money
-- anyway while the Portal recorded nothing. Run the steps in order in the Supabase SQL editor.

-- STEP 1: find her payment in PayPal's list (run this alone first).
-- If it returns nothing, PayPal has not listed it yet or it was paid under another name or email: check PayPal itself.
select transaction_id, paid_on, gross, fee, payer_name, payer_email, subject, items
from public.paypal_transactions
where payer_email ilike '%molaliburt%' or payer_name ilike '%burton%' or payer_name ilike '%spence%'
   or subject ilike '%burton%' or items ilike '%burton%' or items ilike '%MAY-01-2027%'
order by occurred_at desc;

-- STEP 2: only if STEP 1 shows her payment and the Portal does not have it. Put the transaction id and the amount in
-- cents (80000 = $800.00) below, then run STEP 2 and STEP 3 together. Safe to re-run: a payment already recorded is skipped.
insert into public.venue_payments (inquiry_id, venue_code, amount_cents, currency, paypal_order_id, paypal_capture_id, payer_name, payer_email)
select 52, 'MAY-01-2027', 290000 /* $2,900.00 per her PayPal receipt */, 'USD', 'PUT-TRANSACTION-ID-HERE', 'PUT-TRANSACTION-ID-HERE', 'Molly Burton', 'molaliburt@gmail.com'
where 'PUT-TRANSACTION-ID-HERE' !~ 'PUT-TRANSACTION' -- does nothing until you replace the placeholder ids above
  and not exists (select 1 from public.venue_payments where paypal_capture_id = 'PUT-TRANSACTION-ID-HERE');

-- STEP 3: her $2,900 = Initial Payment $800 + Second Payment $2,100. Mark exactly those two paid
-- (the $800 Security Deposit is NOT part of this payment, so it stays due).
update public.venue_payment_schedule
set amount_paid_cents = amount_cents, status = 'paid'
where inquiry_id = 52 and sequence in (0, 2) and coalesce(amount_paid_cents, 0) < amount_cents
  and exists (select 1 from public.venue_payments where inquiry_id = 52 and amount_cents = 290000); -- only once STEP 2 recorded it

-- STEP 4: check. Initial Payment and Second Payment paid; Security Deposit and Third Payment still due.
select sequence, label, amount_cents, amount_paid_cents, status
from public.venue_payment_schedule where inquiry_id = 52 order by sequence;
