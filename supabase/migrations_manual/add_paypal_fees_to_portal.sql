-- Save PayPal's real fee / net / transaction ID on the Portal's own records, so the Portal itself is correct.
-- apply_paypal_fees() is run by the sync-paypal-transactions function after every sync (it is safe to run any time).

alter table public.donations add column if not exists paypal_transaction_id text;
alter table public.donations add column if not exists paypal_fee numeric;
alter table public.donations add column if not exists net_amount numeric;
alter table public.venue_payments add column if not exists paypal_fee numeric;
alter table public.venue_payments add column if not exists net_amount numeric;

create or replace function public.apply_paypal_fees()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare t_n int := 0; v_n int := 0; d_n int := 0; e_n int := 0;
begin
  -- Website orders: same capture id
  update ticket_orders o set paypal_fee = t.fee, net_amount = t.net
  from paypal_transactions t
  where t.transaction_id = o.paypal_capture_id and (o.paypal_fee is distinct from t.fee or o.net_amount is distinct from t.net);
  get diagnostics t_n = row_count;

  -- Online venue payments: same capture id
  update venue_payments p set paypal_fee = t.fee, net_amount = t.net
  from paypal_transactions t
  where t.transaction_id = p.paypal_capture_id and (p.paypal_fee is distinct from t.fee or p.net_amount is distinct from t.net);
  get diagnostics v_n = row_count;

  -- Gifts entered in the Portal: same amount, within 7 days, and the PayPal payer shares a name with the donor.
  -- Each PayPal payment is used once, for the closest date.
  with cand as (
    select d.id as donation_id, t.transaction_id, t.fee, t.net,
           row_number() over (partition by d.id order by abs(t.paid_on - d.date), t.transaction_id) as rk_d,
           abs(t.paid_on - d.date) as gap
    from donations d
    join donors dn on dn.id = d.donor_id
    join paypal_transactions t on t.gross = d.amount and abs(t.paid_on - d.date) <= 7
    where d.paypal_transaction_id is null and d.source_ticket_order_id is null
      and coalesce(d.payment_type, '') <> 'Check'
      and exists (
        select 1 from regexp_split_to_table(lower(regexp_replace(coalesce(t.payer_name, ''), '[^a-zA-Z ]', '', 'g')), ' ') w
        where length(w) > 2 and lower(dn.formal_name) like '%' || w || '%')
      and not exists (select 1 from ticket_orders o where o.paypal_capture_id = t.transaction_id)
      and not exists (select 1 from venue_payments p where p.paypal_capture_id = t.transaction_id)
      and not exists (select 1 from donations x where x.paypal_transaction_id = t.transaction_id)
  ), pick as (
    select distinct on (transaction_id) donation_id, transaction_id, fee, net
    from cand where rk_d = 1 order by transaction_id, gap
  )
  update donations d set paypal_transaction_id = pick.transaction_id, paypal_fee = pick.fee, net_amount = pick.net
  from pick where d.id = pick.donation_id;
  get diagnostics d_n = row_count;

  -- PayPal payments logged by hand on the Treasurer page: match the real PayPal payment (same amount, within 7 days,
  -- payer shares a name) and swap the estimated fee for the real one.
  with cand as (
    select e.id as entry_id, t.transaction_id, t.fee, t.net, abs(t.paid_on - e.paid_on) as gap
    from treasurer_entries e
    join paypal_transactions t on t.gross = e.amount and abs(t.paid_on - e.paid_on) <= 7
    where e.method = 'PayPal' and e.paypal_transaction_id is null
      and exists (
        select 1 from regexp_split_to_table(lower(regexp_replace(coalesce(t.payer_name, ''), '[^a-zA-Z ]', '', 'g')), ' ') w
        where length(w) > 2 and lower(e.payer) like '%' || w || '%')
      and not exists (select 1 from ticket_orders o where o.paypal_capture_id = t.transaction_id)
      and not exists (select 1 from venue_payments p where p.paypal_capture_id = t.transaction_id)
      and not exists (select 1 from donations x where x.paypal_transaction_id = t.transaction_id)
      and not exists (select 1 from treasurer_entries x where x.paypal_transaction_id = t.transaction_id)
  ), pick as (
    select distinct on (transaction_id) entry_id, transaction_id, fee, net from cand order by transaction_id, gap
  )
  update treasurer_entries e set paypal_transaction_id = pick.transaction_id, paypal_fee = pick.fee, net_amount = pick.net, fee_estimated = false
  from pick where e.id = pick.entry_id;
  get diagnostics e_n = row_count;

  -- Gifts already matched earlier: keep their fee in step with PayPal
  update donations d set paypal_fee = t.fee, net_amount = t.net
  from paypal_transactions t
  where d.paypal_transaction_id = t.transaction_id and (d.paypal_fee is distinct from t.fee or d.net_amount is distinct from t.net);

  return jsonb_build_object('orders_updated', t_n, 'venue_updated', v_n, 'gifts_matched', d_n, 'entries_matched', e_n);
end $$;
revoke all on function public.apply_paypal_fees() from public, anon, authenticated;

-- PayPal payments the Portal has no record of (for the Treasurer page to review).
create or replace function public.treasurer_unmatched_paypal()
returns table (transaction_id text, paid_on date, payer_name text, payer_email text, gross numeric, fee numeric, net numeric, description text)
language sql security definer set search_path = public as $$
  select t.transaction_id, t.paid_on, t.payer_name, t.payer_email, t.gross, t.fee, t.net,
         nullif(concat_ws(' · ', t.items, t.subject, t.note), '')
  from paypal_transactions t
  where has_valid_app_session()
    and not exists (select 1 from ticket_orders o where o.paypal_capture_id = t.transaction_id)
    and not exists (select 1 from venue_payments p where p.paypal_capture_id = t.transaction_id)
    and not exists (select 1 from donations d where d.paypal_transaction_id = t.transaction_id)
    and not exists (select 1 from donations d where d.check_number = t.transaction_id)
    and not exists (select 1 from treasurer_entries e where e.paypal_transaction_id = t.transaction_id)
  order by t.paid_on desc;
$$;
grant execute on function public.treasurer_unmatched_paypal() to anon, authenticated;
