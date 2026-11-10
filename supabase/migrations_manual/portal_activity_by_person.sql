-- Activity by person: who did what in the Portal.
--
-- 1. A Portal session now remembers who signed in (it only kept a random token before).
-- 2. portal_activity: one row per change made through the Portal (insert / update / delete),
--    written by a trigger that reads the request's x-app-token header -- so only changes made
--    by a signed-in Portal user are recorded, never the website, the Hub or background functions.
-- 3. The trigger is attached to every public table except logs, caches and session tables.
-- The Portal's Tools > Activity log page reads this plus the older name-tagged records
-- (messages handled, tours guided, tour requests handled, replies sent, ...).
-- 4. Staying signed in: a session lasts a year and every Portal visit pushes it another year out
--    (touch_app_session, called when the Portal opens), so people only sign in again after a year away.
-- Apply one statement at a time (the CLI's db query runs a single statement).

alter table public.app_sessions add column if not exists volunteer_id bigint;
alter table public.app_sessions add column if not exists actor_name text;
alter table public.app_sessions add column if not exists email text;

CREATE OR REPLACE FUNCTION public.issue_app_session(p_user_agent text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_vol bigint;
  v_team text;
  v_status text;
  v_name text;
  v_email text;
  v_token text;
begin
  if v_uid is null then return null; end if;

  select l.volunteer_id into v_vol from public.volunteer_auth_links l where l.auth_user_id = v_uid limit 1;
  if v_vol is null then
    select v.id into v_vol
    from public."2026 Volunteers" v
    join auth.users u on lower(u.email) = lower(v."Email")
    where u.id = v_uid and u.email_confirmed_at is not null
    limit 1;
  end if;
  if v_vol is null then return null; end if;

  select v."Team", v."Status", nullif(trim(coalesce(trim(v."First Name"), '') || ' ' || coalesce(trim(v."Last Name"), '')), '')
    into v_team, v_status, v_name
    from public."2026 Volunteers" v where v.id = v_vol;
  if coalesce(v_status, '') <> 'Active' then return null; end if;
  if not exists (
    select 1 from regexp_split_to_table(coalesce(v_team, ''), '[|,]') t
    where lower(trim(t)) in ('staff', 'board member', 'team lead')
  ) then return null; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.app_sessions (token, expires_at, user_agent, volunteer_id, actor_name, email)
  values (v_token, now() + interval '365 days', p_user_agent, v_vol, v_name, v_email);
  return v_token;
end
$function$;

-- The Portal calls this when it opens: true if the session is good, and the session is pushed a year out.
CREATE OR REPLACE FUNCTION public.touch_app_session()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_token text; v_ok boolean;
begin
  v_token := current_setting('request.headers', true)::json->>'x-app-token';
  if v_token is null or v_token = '' then return false; end if;
  update public.app_sessions set last_seen = now(), expires_at = greatest(expires_at, now() + interval '365 days')
    where token = v_token and expires_at > now()
    returning true into v_ok;
  return coalesce(v_ok, false);
end
$function$;

grant execute on function public.touch_app_session() to anon, authenticated;

create table if not exists public.portal_activity (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_name text not null,
  volunteer_id bigint,
  table_name text not null,
  op text not null,
  row_id text,
  label text,
  changed text[]
);

create index if not exists portal_activity_actor_idx on public.portal_activity (actor_name, created_at desc);

alter table public.portal_activity enable row level security;

create policy portal_activity_read on public.portal_activity for select to anon, authenticated using (public.has_valid_app_session());

revoke insert, update, delete on public.portal_activity from anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_portal_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_token text; v_name text; v_vol bigint;
  r jsonb; o jsonb; v_changed text[]; v_label text;
begin
  begin
    v_token := current_setting('request.headers', true)::json->>'x-app-token';
    if v_token is null or v_token = '' then return null; end if;
    select s.actor_name, s.volunteer_id into v_name, v_vol from public.app_sessions s where s.token = v_token and s.expires_at > now();
    if v_name is null then return null; end if;

    r := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
    if TG_OP = 'UPDATE' then
      o := to_jsonb(OLD);
      -- which fields changed; for a form response's answers, which answers (e.g. __venue_checklist)
      select array_agg(k order by k) into v_changed from (
        select k from jsonb_object_keys(r) k
        where k not in ('updated_at', 'modified_at', 'last_seen', 'answers') and (r->k) is distinct from (o->k)
        union all
        select 'answers.' || a from jsonb_object_keys(case when jsonb_typeof(r->'answers') = 'object' then r->'answers' else '{}'::jsonb end) a
        where jsonb_typeof(o->'answers') = 'object' and (r->'answers'->a) is distinct from (o->'answers'->a)
      ) x;
      if v_changed is null then return null; end if;
    end if;

    v_label := coalesce(
      nullif(trim(coalesce(r->>'First Name', '') || ' ' || coalesce(r->>'Last Name', '')), ''),
      r->>'name', r->>'title', r->>'event_title', r->>'visitor_name', r->>'subject', r->>'full_name',
      r->'answers'->>'__event_name', r->'answers'->>'evp_org', r->'answers'->>'evp_name',
      r->>'label', r->>'description', r->>'area', r->>'Name');
    insert into public.portal_activity (actor_name, volunteer_id, table_name, op, row_id, label, changed)
    values (v_name, v_vol, TG_TABLE_NAME, lower(TG_OP), r->>'id', left(v_label, 160), v_changed);
  exception when others then
    null; -- never block the change itself
  end;
  return null;
end
$function$;

-- attach to every public table except logs, caches, sessions and this log itself
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('portal_activity', 'app_sessions', 'app_passwords', 'private_config', 'kiosk_logs', 'payment_backup_log',
        'email_notices_log', 'volunteer_email_logs', 'volunteer_birthday_email_log', 'marketing_posting_log', 'calendar_events_cache',
        'sheet_sync_state', 'venue_drive_locks', 'form_responses_seen', 'site_content_revisions', 'site_post_revisions')
  loop
    execute format('drop trigger if exists zz_portal_activity on public.%I', t.relname);
    execute format('create trigger zz_portal_activity after insert or update or delete on public.%I for each row execute function public.log_portal_change()', t.relname);
  end loop;
end $$;

-- sign everyone out once: sessions from before this change do not know who signed in
update public.app_sessions set expires_at = now() where actor_name is null and expires_at > now();
