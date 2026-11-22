-- When a booking's event date changes, move the due dates of its UNPAID scheduled payments to match the new date.
-- Safe to re-run.
--
-- Why: a payment schedule is built once, from the event date on the pre-booking form. If the client then fixes their date
-- (a second submission) or staff edit it, the schedule used to keep the old dates (Joseph Price + Alyssa Beltran, Nov 2026:
-- built for May 15, 2027, wedding actually July 10, 2027, so the Second Payment showed as already past due).
--
-- What it touches: only the due_date of payments that have nothing paid on them. Amounts, labels, paid payments, the initial
-- booking payment and extra-hours / rehearsal charges are never changed. It follows the same rules the schedules are built with:
--   * weddings: each installment is due (offset_months) before the event, per venue_config 'wedding_payment_plan';
--     the security deposit is due (due_days_before) days before the event, per venue_config 'security_deposit'
--   * other events with a custom price: the rental fee is due 90 days before (or today if that has passed), the deposit 30 days before
-- Every change is written to the Activity Log, because an agreement that was already sent still shows the old dates.

create or replace function public.reflow_venue_payment_dates(p_inquiry_id bigint)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inq venue_inquiries%rowtype;
  v_plan jsonb;
  v_deposit jsonb;
  v_inst jsonb;
  v_changed integer := 0;
  v_n integer;
begin
  select * into v_inq from venue_inquiries where id = p_inquiry_id;
  if not found or v_inq.event_date is null then return 0; end if;

  if coalesce(v_inq.event_type, '') ilike 'wedding%' then
    select value into v_plan from venue_config where key = 'wedding_payment_plan';
    select value into v_deposit from venue_config where key = 'security_deposit';

    for v_inst in select * from jsonb_array_elements(coalesce(v_plan->'installments', '[]'::jsonb))
    loop
      update venue_payment_schedule
         set due_date = (v_inq.event_date - (coalesce((v_inst->>'offset_months')::integer, 0) * interval '1 month'))::date
       where inquiry_id = p_inquiry_id and kind = 'installment' and label = coalesce(v_inst->>'label', 'Payment')
         and coalesce(amount_paid_cents, 0) = 0 and status <> 'paid'
         and due_date is distinct from (v_inq.event_date - (coalesce((v_inst->>'offset_months')::integer, 0) * interval '1 month'))::date;
      get diagnostics v_n = row_count; v_changed := v_changed + v_n;
    end loop;

    if v_deposit is not null then
      update venue_payment_schedule
         set due_date = v_inq.event_date - coalesce((v_deposit->>'due_days_before')::integer, 30)
       where inquiry_id = p_inquiry_id and kind = 'security_deposit'
         and coalesce(amount_paid_cents, 0) = 0 and status <> 'paid'
         and due_date is distinct from v_inq.event_date - coalesce((v_deposit->>'due_days_before')::integer, 30);
      get diagnostics v_n = row_count; v_changed := v_changed + v_n;
    end if;
  else
    update venue_payment_schedule
       set due_date = greatest(current_date, v_inq.event_date - 90)
     where inquiry_id = p_inquiry_id and kind = 'initial' and label = 'Venue Rental Fee'
       and coalesce(amount_paid_cents, 0) = 0 and status <> 'paid'
       and due_date is distinct from greatest(current_date, v_inq.event_date - 90);
    get diagnostics v_n = row_count; v_changed := v_changed + v_n;

    update venue_payment_schedule
       set due_date = v_inq.event_date - 30
     where inquiry_id = p_inquiry_id and kind = 'security_deposit'
       and coalesce(amount_paid_cents, 0) = 0 and status <> 'paid'
       and due_date is distinct from v_inq.event_date - 30;
    get diagnostics v_n = row_count; v_changed := v_changed + v_n;
  end if;

  if v_changed > 0 then
    insert into activity_log (action, description, detail)
    values ('payment_dates_recalculated',
            'Payment due dates were recalculated for ' || coalesce(v_inq.name, 'a booking') || ' after the event date changed to ' || to_char(v_inq.event_date, 'FMMon FMDD, YYYY') || '. If an agreement was already sent, it still shows the old dates.',
            jsonb_build_object('inquiry_id', p_inquiry_id, 'event_date', v_inq.event_date, 'payments_updated', v_changed));
  end if;
  return v_changed;
end;
$function$;

create or replace function public.trg_reflow_payment_dates()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform reflow_venue_payment_dates(new.id);
  exception when others then
    raise warning 'reflow_venue_payment_dates failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

drop trigger if exists reflow_payment_dates_on_event_date on public.venue_inquiries;
create trigger reflow_payment_dates_on_event_date
  after update of event_date on public.venue_inquiries
  for each row
  when (new.event_date is not null and old.event_date is distinct from new.event_date)
  execute function public.trg_reflow_payment_dates();
