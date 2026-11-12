-- Venue Rentals > Following: staff "follow" a couple (by email) to watch them move through the whole process:
-- tour -> pre-booking form -> agreement signed -> first payment -> wedding/event. Email is the thread that ties a tour
-- (estate_tours), an inquiry (venue_inquiries) and a pre-booking form (nsh_form_responses) together.
-- Each follow belongs to whoever is signed in (stamped by the database). Apply one statement at a time.

create table if not exists public.venue_follows (
  id uuid primary key default gen_random_uuid(),
  follower text not null,
  email text not null,
  name text,
  note text,
  created_at timestamptz not null default now(),
  unique (follower, email)
);

alter table public.venue_follows enable row level security;

create policy "portal session all venue_follows" on public.venue_follows for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

grant select, insert, update, delete on public.venue_follows to anon;

CREATE OR REPLACE FUNCTION public.venue_follows_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'INSERT' then
    new.follower := coalesce(public.app_session_name(), new.follower);
    new.created_at := now();
  else
    new.follower := old.follower;
  end if;
  if coalesce(new.follower, '') = '' then raise exception 'Sign in to follow a couple'; end if;
  return new;
end
$function$;

drop trigger if exists venue_follows_stamp on public.venue_follows;

create trigger venue_follows_stamp before insert or update on public.venue_follows for each row execute function public.venue_follows_stamp();

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
  paid_at timestamptz;
  ev_date text;
  booked_hb boolean;
begin
  if not public.has_valid_app_session() then raise exception 'Not signed in'; end if;
  for f in select * from venue_follows order by created_at desc loop
    select id, date, guide_name, status, category, visitor_name into t
      from estate_tours where lower(trim(visitor_email)) = f.email order by date desc nulls last limit 1;
    select id, name, status, event_type, event_date, created_at, prebooking_form_response_id, payment_retainer_paid into i
      from venue_inquiries where lower(trim(email)) = f.email order by created_at desc limit 1;
    select id, form_id, created_at, answers into r
      from nsh_form_responses
      where form_id in ('a3a383f7-e1db-4344-9dec-ea879ad3406d', '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8')
        and (id = i.prebooking_form_response_id or lower(answers::text) like '%"' || f.email || '"%')
      order by (id = i.prebooking_form_response_id) desc nulls last, created_at desc limit 1;
    signed_at := null; paid_at := null; booked_hb := false; ev_date := null;
    if r.id is not null then
      select max(completed_at) into signed_at from venue_agreement_versions where response_id = r.id and status = 'completed';
      booked_hb := r.answers ? '__honeybook';
      ev_date := coalesce(r.answers->>'sn9urgfr', r.answers->>'evp_date', r.answers->'__honeybook'->'project'->>'project_date');
    end if;
    if i.id is not null then
      select min(s.paid_at) into paid_at from venue_payment_schedule s where s.inquiry_id = i.id and s.status = 'paid';
      ev_date := coalesce(i.event_date::text, ev_date);
    end if;
    out := out || jsonb_build_object(
      'id', f.id, 'follower', f.follower, 'email', f.email, 'name', coalesce(f.name, i.name, t.visitor_name), 'note', f.note, 'followed_at', f.created_at,
      'tour', case when t.id is null then null else jsonb_build_object('date', t.date, 'guide', t.guide_name, 'status', t.status, 'category', t.category) end,
      'inquiry', case when i.id is null then null else jsonb_build_object('status', i.status, 'event_type', i.event_type, 'created_at', i.created_at) end,
      'prebooking', case when r.id is null then null else jsonb_build_object('id', r.id, 'at', r.created_at, 'kind', case when r.form_id = 'a3a383f7-e1db-4344-9dec-ea879ad3406d' then 'Wedding' else 'Event' end) end,
      'signed', case when signed_at is not null then to_jsonb(signed_at) when booked_hb then to_jsonb('booked'::text) else null end,
      'paid', case when paid_at is not null then to_jsonb(paid_at) when coalesce(i.payment_retainer_paid, false) then to_jsonb('paid'::text) else null end,
      'event_date', left(ev_date, 10)
    );
  end loop;
  return out;
end
$function$;

grant execute on function public.venue_follow_progress() to anon;
