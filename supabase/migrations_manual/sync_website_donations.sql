-- A donation made on the website (a ticket_orders row of kind 'donation') becomes a row in the Portal's donations table by
-- itself, the way commemorative-brick purchases already do. Before this, general website donations were only in ticket_orders,
-- so Operational > Finance > Donations never showed them. The donor is matched by email (or added), the date is the Pacific-time
-- day it was made, and the thank-you letter is queued like any other donation. Safe to re-run: one donation row per order.
create or replace function public.sync_website_donation_to_donations() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text; v_donor_id uuid;
begin
  if new.kind is distinct from 'donation' or new.status is distinct from 'completed' then return new; end if;
  if exists (select 1 from donations where source_ticket_order_id = new.id) then return new; end if;
  v_email := lower(nullif(trim(coalesce(new.buyer_email, new.paypal_payer_email, '')), ''));
  if v_email is not null then select id into v_donor_id from donors where lower(email) = v_email limit 1; end if;
  if v_donor_id is null then
    insert into donors (formal_name, email, phone)
    values (coalesce(nullif(trim(new.buyer_name), ''), new.paypal_payer_name, 'Unknown Donor'), v_email, nullif(trim(new.buyer_phone), ''))
    returning id into v_donor_id;
  end if;
  insert into donations (donor_id, amount, date, type, payment_type, donation_notes, acknowledged, acknowledgment_status, source_ticket_order_id, paypal_transaction_id, paypal_fee, net_amount)
  values (v_donor_id, new.amount, (new.created_at at time zone 'America/Los_Angeles')::date, 'Donation', 'Website', nullif(trim(coalesce(new.note, '')), ''), false, 'ready_to_generate', new.id, new.paypal_capture_id, new.paypal_fee, new.net_amount);
  return new;
exception when others then
  raise warning 'sync_website_donation_to_donations failed for ticket_orders.id=%: %', new.id, sqlerrm;
  return new;
end $$;
drop trigger if exists trg_sync_website_donation_to_donations on public.ticket_orders;
create trigger trg_sync_website_donation_to_donations after insert or update of status on public.ticket_orders
  for each row execute function public.sync_website_donation_to_donations();

-- the website donations that were never copied over
do $$ declare r record; begin
  for r in select id from public.ticket_orders where kind = 'donation' and status = 'completed' and not exists (select 1 from public.donations d where d.source_ticket_order_id = ticket_orders.id) loop
    update public.ticket_orders set status = status where id = r.id;
  end loop;
end $$;
