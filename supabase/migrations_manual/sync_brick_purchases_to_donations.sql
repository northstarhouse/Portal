-- Automatically mirror website brick purchases (ticket_orders with event_slug =
-- 'commemorative-brick') into the donations table, matching the existing manual-entry
-- convention for brick donations (payment_type='Website', acknowledgment_status='ready_to_generate').
-- Matches/creates a donor by email so these show up linked to a real donor record.

alter table donations
  add column if not exists source_ticket_order_id uuid references ticket_orders(id);

create unique index if not exists donations_source_ticket_order_id_key
  on donations (source_ticket_order_id)
  where source_ticket_order_id is not null;

create or replace function sync_brick_purchase_to_donations()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_donor_id uuid;
  v_inscription text;
  v_size text;
  v_notes text;
begin
  if new.event_slug <> 'commemorative-brick' or new.status <> 'completed' then
    return new;
  end if;

  if exists (select 1 from donations where source_ticket_order_id = new.id) then
    return new;
  end if;

  v_email := lower(nullif(trim(coalesce(new.buyer_email, new.paypal_payer_email, '')), ''));

  if v_email is not null then
    select id into v_donor_id from donors where lower(email) = v_email limit 1;
  end if;

  if v_donor_id is null then
    insert into donors (formal_name, email, phone)
    values (
      coalesce(nullif(trim(new.buyer_name), ''), new.paypal_payer_name, 'Unknown Donor'),
      v_email,
      nullif(trim(new.buyer_phone), '')
    )
    returning id into v_donor_id;
  end if;

  v_inscription := nullif(trim(regexp_replace(coalesce(new.note, ''), '^Engraving:\s*', '')), '');
  v_size := (select (regexp_match(new.tickets->0->>'tier', '(\d+)"?\s*x\s*(\d+)"?'))[1] || 'x' ||
             (regexp_match(new.tickets->0->>'tier', '(\d+)"?\s*x\s*(\d+)"?'))[2]);
  v_notes := 'Commemorative Brick Size:' || coalesce(v_size, '?') ||
             ' | What would you like to engrave on your brick?:' || coalesce(v_inscription, '');

  insert into donations (
    donor_id, amount, date, type, payment_type,
    brick_inscription, donation_notes, acknowledged, acknowledgment_status,
    source_ticket_order_id
  ) values (
    v_donor_id, new.amount, new.created_at::date, 'Brick Purchase', 'Website',
    v_inscription, v_notes, false, 'ready_to_generate',
    new.id
  );

  return new;
exception when others then
  raise warning 'sync_brick_purchase_to_donations failed for ticket_orders.id=%: %', new.id, sqlerrm;
  return new;
end;
$function$;

drop trigger if exists trg_sync_brick_purchase_to_donations on ticket_orders;
create trigger trg_sync_brick_purchase_to_donations
  after insert on ticket_orders
  for each row
  execute function sync_brick_purchase_to_donations();

-- Backfill any brick orders that already came in before this trigger existed.
do $$
declare
  r record;
  v_email text;
  v_donor_id uuid;
  v_inscription text;
  v_size text;
  v_notes text;
begin
  for r in
    select * from ticket_orders
    where event_slug = 'commemorative-brick'
      and status = 'completed'
      and id not in (select source_ticket_order_id from donations where source_ticket_order_id is not null)
  loop
    v_email := lower(nullif(trim(coalesce(r.buyer_email, r.paypal_payer_email, '')), ''));
    v_donor_id := null;

    if v_email is not null then
      select id into v_donor_id from donors where lower(email) = v_email limit 1;
    end if;

    if v_donor_id is null then
      insert into donors (formal_name, email, phone)
      values (
        coalesce(nullif(trim(r.buyer_name), ''), r.paypal_payer_name, 'Unknown Donor'),
        v_email,
        nullif(trim(r.buyer_phone), '')
      )
      returning id into v_donor_id;
    end if;

    v_inscription := nullif(trim(regexp_replace(coalesce(r.note, ''), '^Engraving:\s*', '')), '');
    v_size := (select (regexp_match(r.tickets->0->>'tier', '(\d+)"?\s*x\s*(\d+)"?'))[1] || 'x' ||
               (regexp_match(r.tickets->0->>'tier', '(\d+)"?\s*x\s*(\d+)"?'))[2]);
    v_notes := 'Commemorative Brick Size:' || coalesce(v_size, '?') ||
               ' | What would you like to engrave on your brick?:' || coalesce(v_inscription, '');

    insert into donations (
      donor_id, amount, date, type, payment_type,
      brick_inscription, donation_notes, acknowledged, acknowledgment_status,
      source_ticket_order_id
    ) values (
      v_donor_id, r.amount, r.created_at::date, 'Brick Purchase', 'Website',
      v_inscription, v_notes, false, 'ready_to_generate',
      r.id
    );
  end loop;
end $$;
