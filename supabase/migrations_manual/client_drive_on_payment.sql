-- A client's Drive folder is now only made once they have paid something (see hasPayment in client-drive-sync).
-- So a payment has to trigger the filing: when an online payment lands on the payment schedule, sync that client's folder.
create or replace function public.trg_client_drive_payment() returns trigger language plpgsql as $$
declare v_resp uuid;
begin
  if coalesce(new.amount_paid_cents, 0) > coalesce(old.amount_paid_cents, 0) then
    select prebooking_form_response_id into v_resp from public.venue_inquiries where id = new.inquiry_id;
    if v_resp is not null then perform public.fire_client_drive_sync(v_resp); end if;
  end if;
  return new;
end $$;
drop trigger if exists client_drive_payment on public.venue_payment_schedule;
create trigger client_drive_payment after update of amount_paid_cents on public.venue_payment_schedule
  for each row execute function public.trg_client_drive_payment();
