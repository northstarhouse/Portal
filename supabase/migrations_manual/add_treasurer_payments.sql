-- Treasurer ledger: every payment in one list, one row per payment.
-- Reads from the places money is already recorded (venue rentals, website orders, donations), so nothing is entered twice.
-- Website donations/memberships/bricks that were copied into `donations` are counted once (via source_ticket_order_id).
-- Venue payments made by PayPal are counted once (venue_payments wins over the matching "Paid online (PayPal)" note).

create table if not exists public.payment_backup_log (
  payment_key text primary key,
  backed_up_at timestamptz not null default now()
);
alter table public.payment_backup_log enable row level security; -- service role only

-- Which installment an online venue payment paid (e.g. "Payment 2 of 4 - Booking payment"), saved when the client pays.
alter table public.venue_payments add column if not exists installment_note text;

create table if not exists public.treasurer_entries (
  id uuid primary key default gen_random_uuid(),
  paid_on date not null default current_date,
  amount numeric not null check (amount > 0),
  source text not null default 'Other',
  payer text not null,
  method text not null default 'Check',
  check_number text,
  note text,
  entered_by text,
  created_at timestamptz not null default now()
);
-- PayPal payments logged by hand carry their fee: an estimate at first (1.99% + $0.49, PayPal's nonprofit rate), replaced
-- by PayPal's real fee once the payment shows up in PayPal's transaction list (apply_paypal_fees).
alter table public.treasurer_entries add column if not exists paypal_fee numeric;
alter table public.treasurer_entries add column if not exists net_amount numeric;
alter table public.treasurer_entries add column if not exists fee_estimated boolean not null default false;
alter table public.treasurer_entries add column if not exists paypal_transaction_id text;
alter table public.treasurer_entries enable row level security;
drop policy if exists treasurer_entries_app on public.treasurer_entries;
create policy treasurer_entries_app on public.treasurer_entries for all using (has_valid_app_session()) with check (has_valid_app_session());

drop function if exists public.treasurer_payments();
drop function if exists public.treasurer_payments_all();

create or replace function public.treasurer_payments_all()
returns table (
  payment_key text, paid_on date, source text, category text, payer text, detail text,
  amount numeric, fee numeric, net numeric, method text, reference text, fee_estimated boolean
)
language sql security definer set search_path = public as $$
  select * from (
    -- Donations, memberships, sponsorships, bricks recorded in the Portal
    select 'don:' || d.id::text, d.date, 'Donations & Memberships'::text, coalesce(d.type, 'Donation'),
           coalesce(dn.formal_name, 'Unknown donor'),
           nullif(concat_ws(' · ', d.event_name, d.sponsorship_level, d.membership_level, d.donation_notes), ''),
           coalesce(d.amount, 0)::numeric, coalesce(d.paypal_fee, o.paypal_fee), coalesce(d.net_amount, o.net_amount),
           coalesce(d.payment_type, 'Unknown'),
           coalesce(d.check_number, d.paypal_transaction_id, o.paypal_capture_id), false
    from donations d
    left join donors dn on dn.id = d.donor_id
    left join ticket_orders o on o.id = d.source_ticket_order_id
    where coalesce(d.amount, 0) > 0

    union all
    -- Website PayPal orders (tickets, and donations/memberships/bricks not already in `donations`)
    select 'ord:' || o.id::text, (o.created_at at time zone 'America/Los_Angeles')::date, 'Website'::text,
           case o.kind when 'paid' then 'Tickets' when 'donation' then 'Donation' when 'membership' then 'Membership' when 'brick' then 'Brick' else initcap(o.kind) end,
           coalesce(nullif(o.paypal_payer_name, ''), o.buyer_name, 'Unknown'),
           nullif(concat_ws(' · ', o.event_title, o.event_date), ''),
           coalesce(o.amount, 0)::numeric, o.paypal_fee, o.net_amount, case when o.paypal_capture_id is null then initcap(coalesce(nullif(o.source, ''), 'Cash')) else 'PayPal' end, coalesce(o.paypal_capture_id, o.note), false
    from ticket_orders o
    where o.status = 'completed' and coalesce(o.amount, 0) > 0
      and not exists (select 1 from donations d where d.source_ticket_order_id = o.id)

    union all
    -- Cash and checks entered by hand on the Treasurer page
    select 'man:' || e.id::text, e.paid_on, e.source, 'Entered by hand'::text, e.payer, e.note, e.amount, e.paypal_fee, e.net_amount, e.method, coalesce(e.paypal_transaction_id, e.check_number), (e.fee_estimated and e.paypal_transaction_id is null)
    from treasurer_entries e

    union all
    -- Venue rental payments made online (PayPal)
    select 'vp:' || p.id::text, (p.created_at at time zone 'America/Los_Angeles')::date, 'Venue Rental'::text, 'Rental payment',
           coalesce(i.name, p.payer_name, 'Venue client'),
           nullif(concat_ws(' · ', i.event_type, to_char(i.event_date, 'Mon FMDD, YYYY')), ''),
           (p.amount_cents / 100.0)::numeric, p.paypal_fee, p.net_amount, 'PayPal', concat_ws(' · ', p.installment_note, p.paypal_capture_id), false
    from venue_payments p
    left join venue_inquiries i on i.id = p.inquiry_id

    union all
    -- Venue rental payments HoneyBook recorded as paid (clients booked before the Portal took payments), on the date HoneyBook paid them
    select 'hb:' || i.id::text || ':' || (s.ord)::text,
           coalesce(((s.item->>'paid_at')::timestamptz at time zone 'America/Los_Angeles')::date, nullif(s.item->>'due_date', '')::date, i.created_at::date),
           'Venue Rental'::text, 'Rental payment', coalesce(i.name, 'Venue client'),
           nullif(concat_ws(' · ', i.event_type, to_char(i.event_date, 'Mon FMDD, YYYY')), ''),
           ((s.item->'amount'->>'amount')::numeric / 100.0), null::numeric, null::numeric, 'HoneyBook',
           'Payment ' || s.ord || ' of ' || s.n || ' · HoneyBook', false
    from venue_inquiries i
    join nsh_form_responses r on r.id = i.prebooking_form_response_id
    cross join lateral (
      select fr from jsonb_array_elements(coalesce(r.answers->'__honeybook'->'file_responses', '[]'::jsonb)) fr
      where jsonb_typeof(fr->'responses'->'payments') = 'object'
      order by coalesce((select f->>'updated_at' from jsonb_array_elements(coalesce(r.answers->'__honeybook'->'files', '[]'::jsonb)) f where f->>'id' = fr->>'id' limit 1), '') desc
      limit 1
    ) inv
    cross join lateral (
      select x.item, row_number() over (order by coalesce(x.item->>'due_date', '9999')) as ord, count(*) over () as n
      from jsonb_array_elements(coalesce(inv.fr->'responses'->'payments'->'schedule', '[]'::jsonb)) as x(item)
    ) s
    where coalesce((s.item->>'paid')::boolean, false) and coalesce((s.item->'amount'->>'amount')::numeric, 0) > 0

    union all
    -- Venue rental payments logged by hand (check, cash, paid before the new system)
    select 'vm:' || i.id::text || ':' || (mp->>'id'), coalesce((mp->>'date')::date, i.created_at::date), 'Venue Rental'::text, 'Rental payment',
           coalesce(i.name, 'Venue client'),
           nullif(concat_ws(' · ', i.event_type, to_char(i.event_date, 'Mon FMDD, YYYY'), mp->>'note'), ''),
           ((mp->>'cents')::numeric / 100.0), null::numeric, null::numeric, 'Recorded by hand', mp->>'id', false
    from venue_inquiries i
    join nsh_form_responses r on r.id = i.prebooking_form_response_id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.answers->'__venue_checklist'->'manual_payments') = 'array' then r.answers->'__venue_checklist'->'manual_payments' else '[]'::jsonb end) mp
    where coalesce((mp->>'cents')::numeric, 0) > 0
      and not exists (select 1 from venue_payments p where 'pp-' || p.paypal_capture_id = mp->>'id')
  ) x(payment_key, paid_on, source, category, payer, detail, amount, fee, net, method, reference, fee_estimated)

  order by paid_on desc nulls last;
$$;


-- Only the backup (service role) may read the unfiltered list.
revoke all on function public.treasurer_payments_all() from public, anon, authenticated;

-- What the Portal calls: same list, only for a signed-in Portal session.
create or replace function public.treasurer_payments()
returns table (
  payment_key text, paid_on date, source text, category text, payer text, detail text,
  amount numeric, fee numeric, net numeric, method text, reference text, fee_estimated boolean
)
language sql security definer set search_path = public as $$
  select * from public.treasurer_payments_all() where has_valid_app_session();
$$;
grant execute on function public.treasurer_payments() to anon, authenticated;
