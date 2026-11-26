-- 1) Website ticket sales -> event earnings. Every paid website order keeps ONE running line per event in Op Earnings
--    (area Events, source "Website tickets"): the total after PayPal's fee. It is recalculated whenever an order is added,
--    changed or removed, so Operational > Events > Earnings always shows it. Events that were sold elsewhere (Wix, door,
--    cash) keep their hand-entered lines; nothing here touches those.
-- 2) A ticket cap per event (site_events.ticket_capacity). When an order lands, the remaining tickets are worked out: the
--    most one checkout can buy is lowered to what is left, and the event is marked sold out at zero. A payment already
--    in progress when the last tickets go cannot be stopped from here, so the cap can be passed by one such order.
-- Safe to re-run.

alter table public.site_events add column if not exists ticket_capacity integer;

create or replace function public.sync_ticket_earnings(p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare v_net numeric; v_date date; v_id bigint;
begin
  if p_title is null or btrim(p_title) = '' or lower(btrim(p_title)) = 'general donation' or p_title ilike '%commemorative brick%' then return; end if;
  select coalesce(sum(coalesce(net_amount, amount - coalesce(paypal_fee, 0))), 0) into v_net
    from public.ticket_orders where event_title = p_title and status = 'completed' and kind in ('paid', 'donation', 'membership', 'brick');
  begin
    select to_date(event_date, 'FMMonth FMDD, YYYY') into v_date from public.ticket_orders where event_title = p_title and event_date is not null limit 1;
  exception when others then v_date := null; end;
  select id into v_id from public."Op Earnings" where area = 'Events' and event = p_title and earning_source = 'Website tickets' limit 1;
  if v_net > 0 then
    if v_id is null then
      insert into public."Op Earnings" (area, event, earning_source, amount, notes, date)
        values ('Events', p_title, 'Website tickets', round(v_net, 2), 'Added automatically from website ticket sales, after PayPal fees.', v_date);
    else
      update public."Op Earnings" set amount = round(v_net, 2), date = coalesce(v_date, date) where id = v_id and amount is distinct from round(v_net, 2);
    end if;
  elsif v_id is not null then
    delete from public."Op Earnings" where id = v_id;
  end if;
end $$;

create or replace function public.sync_ticket_capacity(p_slug text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cap integer; v_sold integer; v_left integer; v_ev public.site_events%rowtype;
begin
  if p_slug is null then return; end if;
  select * into v_ev from public.site_events where slug = p_slug;
  if not found or v_ev.ticket_capacity is null then return; end if;
  select coalesce(sum(quantity), 0) into v_sold from public.ticket_orders where event_slug = p_slug and status = 'completed' and kind = 'paid';
  v_left := greatest(v_ev.ticket_capacity - v_sold, 0);
  update public.site_events set
    sold_out = (v_left = 0),
    ticket_limit_per_order = greatest(least(coalesce(ticket_limit_per_order, 20), v_left), 1),
    ticket_tiers = coalesce((select jsonb_agg(t || jsonb_build_object('limitPerCheckout', greatest(least(coalesce((t->>'limitPerCheckout')::int, 20), v_left), 1), 'soldOut', (v_left = 0))) from jsonb_array_elements(ticket_tiers) t), ticket_tiers)
  where id = v_ev.id;
end $$;

create or replace function public.trg_ticket_order_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then perform public.sync_ticket_earnings(new.event_title); perform public.sync_ticket_capacity(new.event_slug); end if;
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.event_title is distinct from new.event_title or old.event_slug is distinct from new.event_slug) then
    perform public.sync_ticket_earnings(old.event_title); perform public.sync_ticket_capacity(old.event_slug);
  end if;
  return coalesce(new, old);
exception when others then
  return coalesce(new, old); -- bookkeeping must never block a ticket sale
end $$;
drop trigger if exists ticket_order_sync on public.ticket_orders;
create trigger ticket_order_sync after insert or update or delete on public.ticket_orders
  for each row execute function public.trg_ticket_order_sync();
