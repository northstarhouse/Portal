-- One combined, read-only list of every money entry, carrying the Portal's four money tags:
--   expenses: area (where it was spent) and paid_from (nsh_direct | cash_box | reimbursement | in_kind)
--   income:   type (venue | events | donation | membership | brick | sponsorship | class_fees | other) and
--             received_into (paypal | cash_box | check | bank | other)
-- direction is 'in' or 'out'; amount is always positive. It only READS the existing tables (nothing is copied or changed), and money
-- that is already copied between tables is listed once: website donations and brick purchases live in donations (not again as
-- ticket orders), website ticket earnings come from ticket_orders (not the automatic "Website tickets" earnings line), and sponsor
-- cash that already has a donation is not listed again from the sponsor's contribution lines.
-- security_invoker makes the view obey the same access rules as the tables underneath it. Safe to re-run.
-- venue_payments is not readable by the app's own role, so the view reads it through this staff-only function.
create or replace function public.ledger_venue_payments()
returns table (id uuid, created_at timestamptz, amount_cents numeric, payer_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.created_at, p.amount_cents::numeric, p.payer_name from public.venue_payments p where public.has_valid_app_session();
$$;
revoke all on function public.ledger_venue_payments() from public;
grant execute on function public.ledger_venue_payments() to anon, authenticated;
create or replace view public.money_ledger with (security_invoker = true) as
  -- spending (Operational budget: Portal and Volunteer Hub both write here)
  select 'op_budget'::text as src, b.id::text as src_id, b.date::date as date, 'out'::text as direction, coalesce(b.amount, 0)::numeric as amount,
         coalesce(nullif(btrim(b.area), ''), 'Unassigned') as area, null::text as type,
         case when b.type = 'In-Kind' then 'in_kind' when coalesce(b.needs_reimbursement, false) then 'reimbursement' else 'nsh_direct' end as paid_from,
         null::text as received_into, coalesce(nullif(btrim(b.purchased_by), ''), nullif(btrim(b.volunteer_name), '')) as who,
         b.description as description, b.event_name as event
  from public."Op Budget" b
  union all
  -- the cash box: money out, and money in
  select 'cash_log', c.id::text, c.date::date, case when c.direction = 'In' then 'in' else 'out' end, coalesce(c.amount, 0)::numeric,
         case when c.direction = 'In' then null else 'Unassigned' end, case when c.direction = 'In' then 'other' else null end,
         case when c.direction = 'In' then null else 'cash_box' end, case when c.direction = 'In' then 'cash_box' else null end,
         null, c.description, null
  from public."Cash Log" c
  union all
  -- donations, memberships, bricks and sponsorships
  select 'donations', d.id::text, d.date::date, 'in', d.amount::numeric, null,
         case when d.type = 'Brick Purchase' then 'brick' when d.type = 'Sponsorship' then 'sponsorship' when d.type ilike 'Membership%' then 'membership' else 'donation' end,
         null,
         case d.payment_type when 'Website' then 'paypal' when 'Cash' then 'cash_box' when 'Check' then 'check' when 'Credit Card' then 'bank' when 'ACH' then 'bank' else 'other' end,
         dn.formal_name, d.donation_notes, d.event_name
  from public.donations d left join public.donors dn on dn.id = d.donor_id
  where coalesce(d.amount, 0) > 0
  union all
  -- event tickets sold on the website (after PayPal's fee)
  select 'ticket_orders', o.id::text, (o.created_at at time zone 'America/Los_Angeles')::date, 'in', coalesce(o.net_amount, o.amount)::numeric, null, 'events', null, 'paypal',
         o.buyer_name, 'Tickets x' || coalesce(o.quantity, 1), o.event_title
  from public.ticket_orders o where o.kind = 'paid' and o.status = 'completed'
  union all
  -- other event earnings logged by hand (not the automatic website tickets line)
  select 'op_earnings', e.id::text, e.date::date, 'in', coalesce(e.amount, 0)::numeric, null, 'events', null, 'other', null, e.earning_source, e.event
  from public."Op Earnings" e where coalesce(e.earning_source, '') <> 'Website tickets'
  union all
  -- creative rentals and class fees
  select 'creative_rentals', r.id::text, r.date::date, 'in', coalesce(r.amount, 0)::numeric, null, 'class_fees', null,
         case r.payment_type when 'Cash' then 'cash_box' when 'Check' then 'check' when 'Credit Card' then 'bank' when 'PayPal' then 'paypal' else 'other' end, null, r.name, null
  from public."Creative Rentals" r
  union all
  -- venue rental payments made online
  select 'venue_payments', p.id::text, (p.created_at at time zone 'America/Los_Angeles')::date, 'in', (coalesce(p.amount_cents, 0) / 100.0)::numeric, null, 'venue', null, 'paypal',
         p.payer_name, 'Venue rental payment', null
  from public.ledger_venue_payments() p
  union all
  -- venue rental payments logged by hand on a client
  select 'venue_manual', (f.id::text || ':' || coalesce(m.value ->> 'id', m.ordinality::text)), (m.value ->> 'date')::date, 'in', ((m.value ->> 'cents')::numeric / 100.0), null, 'venue', null, 'other',
         nullif(m.value ->> 'by', ''), coalesce(nullif(m.value ->> 'note', ''), 'Venue rental payment (logged by hand)'), null
  from public.nsh_form_responses f
  cross join lateral jsonb_array_elements(case when jsonb_typeof(f.answers #> '{__venue_checklist,manual_payments}') = 'array' then f.answers #> '{__venue_checklist,manual_payments}' else '[]'::jsonb end) with ordinality as m(value, ordinality)
  where coalesce((m.value ->> 'cents')::numeric, 0) > 0 and (m.value ->> 'date') ~ '^\d{4}-\d{2}-\d{2}'
  union all
  -- a sponsor's cash contribution that has no donation yet
  select 'sponsor_cash', k.id::text, k.date::date, 'in', coalesce(k.value, 0)::numeric, null, 'sponsorship', null, 'other', s."Business Name", k.description, null
  from public."Sponsor In-Kind" k join public."Sponsors" s on s.id = k.sponsor_id
  where k.contribution_type = 'Monetary Value' and coalesce(k.value, 0) > 0
    and not exists (select 1 from public.donations d where d.sponsor_inkind_id = k.id);
grant select on public.money_ledger to anon, authenticated;
