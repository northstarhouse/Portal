-- Following: each step also says who handled it.
--   Toured           -> the tour guide (full name)
--   Pre-booking form -> who sent it (manual send), or "Auto-sent after tour"
--   Agreement signed -> the staff member who countersigned for the venue
--   First payment    -> "Paid online" (PayPal) or the staff member who logged it by hand
--   Wedding day      -> the assigned site manager
-- Apply as one statement.

CREATE OR REPLACE FUNCTION public.venue_follow_progress()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  out jsonb := '[]'::jsonb;
  f record;
  t record;
  i record;
  r record;
  signed_at timestamptz;
  signed_by text;
  paid_at timestamptz;
  paid_by text;
  cand_at timestamptz;
  cand_by text;
  pre_by text;
  ev_date text;
  sm text;
  booked_hb boolean;
begin
  if not public.has_valid_app_session() then raise exception 'Not signed in'; end if;
  for f in select * from venue_follows order by created_at desc loop
    select id, date, guide_name, status, category, visitor_name, prebooking_form_sent_at into t
      from estate_tours where lower(trim(visitor_email)) = f.email and status = 'booked' order by date desc nulls last limit 1;
    select id, name, status, event_type, event_date, created_at, prebooking_form_response_id, payment_retainer_paid into i
      from venue_inquiries where lower(trim(email)) = f.email order by created_at desc limit 1;
    select id, form_id, created_at, answers into r
      from nsh_form_responses
      where form_id in ('a3a383f7-e1db-4344-9dec-ea879ad3406d', '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8')
        and (id = i.prebooking_form_response_id or lower(answers::text) like '%"' || f.email || '"%')
      order by (id = i.prebooking_form_response_id) desc nulls last, created_at desc limit 1;

    signed_at := null; signed_by := null; paid_at := null; paid_by := null; booked_hb := false; ev_date := null; sm := null; pre_by := null;

    -- who sent the pre-booking form
    select 'Sent by ' || sent_by into pre_by from prebooking_manual_sends where lower(trim(email)) = f.email and coalesce(sent_by, '') <> '' order by sent_at desc limit 1;
    if pre_by is null and exists (select 1 from estate_tours where lower(trim(visitor_email)) = f.email and prebooking_form_sent_at is not null) then
      pre_by := 'Auto-sent after tour';
    end if;

    if r.id is not null then
      if pre_by is null and r.answers->'__entered_by_staff'->>'by' is not null then pre_by := 'Entered by ' || (r.answers->'__entered_by_staff'->>'by'); end if;
      select v.completed_at, (select coalesce(nullif(s.signed_name, ''), s.name) from venue_agreement_signers s where s.version_id = v.id and s.role = 'venue' and s.status = 'signed' order by s.signed_at limit 1)
        into signed_at, signed_by
        from venue_agreement_versions v where v.response_id = r.id and v.status = 'completed' order by v.completed_at desc limit 1;
      booked_hb := r.answers ? '__honeybook';
      if signed_at is null and booked_hb then signed_by := 'HoneyBook'; end if;
      ev_date := coalesce(r.answers->>'sn9urgfr', r.answers->>'evp_date', r.answers->'__honeybook'->'project'->>'project_date');
      sm := nullif(r.answers->'__venue_checklist'->'site_manager'->>'name', '');
      -- first payment logged by hand
      select (m->>'date')::timestamptz, nullif(m->>'by', '') into paid_at, paid_by
        from jsonb_array_elements(coalesce(r.answers->'__venue_checklist'->'manual_payments', '[]'::jsonb)) m
        where (m->>'cents')::int > 0 and m->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        order by m->>'date' limit 1;
      if paid_at is not null and paid_by is null then paid_by := 'Logged by staff'; end if;
    end if;

    -- online (PayPal) payments
    select min(p.created_at) into cand_at from venue_payments p where (i.id is not null and p.inquiry_id = i.id) or lower(trim(p.payer_email)) = f.email;
    if cand_at is not null and (paid_at is null or cand_at < paid_at) then paid_at := cand_at; paid_by := 'Paid online'; end if;
    if i.id is not null then
      select min(s.paid_at) into cand_at from venue_payment_schedule s where s.inquiry_id = i.id and s.status = 'paid';
      if cand_at is not null and (paid_at is null or cand_at < paid_at) then paid_at := cand_at; paid_by := 'Paid online'; end if;
      ev_date := coalesce(i.event_date::text, ev_date);
    end if;

    out := out || jsonb_build_object(
      'id', f.id, 'follower', f.follower, 'email', f.email, 'name', coalesce(f.name, i.name, t.visitor_name), 'note', f.note, 'followed_at', f.created_at,
      'tour', case when t.id is null then null else jsonb_build_object('date', t.date, 'guide', coalesce(public.guide_full_name(t.guide_name), t.guide_name), 'status', t.status, 'category', t.category) end,
      'inquiry', case when i.id is null then null else jsonb_build_object('status', i.status, 'event_type', i.event_type, 'created_at', i.created_at) end,
      'prebooking', case when r.id is null then null else jsonb_build_object('id', r.id, 'at', r.created_at, 'kind', case when r.form_id = 'a3a383f7-e1db-4344-9dec-ea879ad3406d' then 'Wedding' else 'Event' end) end,
      'prebooking_by', pre_by,
      'signed', case when signed_at is not null then to_jsonb(signed_at) when booked_hb then to_jsonb('booked'::text) else null end,
      'signed_by', signed_by,
      'paid', case when paid_at is not null then to_jsonb(paid_at) when coalesce(i.payment_retainer_paid, false) then to_jsonb('paid'::text) else null end,
      'paid_by', paid_by,
      'site_manager', sm,
      'event_date', left(ev_date, 10)
    );
  end loop;
  return out;
end
$function$;
