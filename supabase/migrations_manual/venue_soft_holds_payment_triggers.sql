-- A soft hold becomes a booked event on the NSH calendar when the first payment arrives, so payments trigger the sync too:
-- online PayPal payments (venue_payments) and schedule rows marked paid in the Portal (venue_payment_schedule).
-- Hand-recorded payments live in nsh_form_responses.answers (__venue_checklist.manual_payments), so updates there trigger it as well.
-- Reuses trg_venue_soft_holds_sync() from venue_soft_holds_triggers.sql. Safe to run more than once.

drop trigger if exists venue_soft_holds_on_payment on venue_payments;
create trigger venue_soft_holds_on_payment
  after insert or delete or update of amount_cents, inquiry_id on venue_payments
  for each statement execute function public.trg_venue_soft_holds_sync();

drop trigger if exists venue_soft_holds_on_schedule on venue_payment_schedule;
create trigger venue_soft_holds_on_schedule
  after insert or delete or update of amount_paid_cents, status on venue_payment_schedule
  for each statement execute function public.trg_venue_soft_holds_sync();

drop trigger if exists venue_soft_holds_on_response_update on nsh_form_responses;
create trigger venue_soft_holds_on_response_update
  after update of answers on nsh_form_responses
  for each row when (old.answers->'__venue_checklist'->'manual_payments' is distinct from new.answers->'__venue_checklist'->'manual_payments')
  execute function public.trg_venue_soft_holds_sync();
