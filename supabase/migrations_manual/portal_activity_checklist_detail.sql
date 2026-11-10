-- Activity by person, part 2: say WHAT changed on a client's checklist.
-- A client's checklist lives in nsh_form_responses.answers.__venue_checklist (site manager, insurance, event-day
-- times, paperwork, ...). The log now names the checklist item that changed (e.g. "checklist.site_manager") and
-- keeps its new value in `detail`, so the page can say "Scheduled Jen as site manager for <wedding>".
-- Apply one statement at a time.

alter table public.portal_activity add column if not exists detail jsonb;

CREATE OR REPLACE FUNCTION public.log_portal_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_token text; v_name text; v_vol bigint;
  r jsonb; o jsonb; v_changed text[]; v_label text; v_detail jsonb;
begin
  begin
    v_token := current_setting('request.headers', true)::json->>'x-app-token';
    if v_token is null or v_token = '' then return null; end if;
    select s.actor_name, s.volunteer_id into v_name, v_vol from public.app_sessions s where s.token = v_token and s.expires_at > now();
    if v_name is null then return null; end if;

    r := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
    if TG_OP = 'UPDATE' then
      o := to_jsonb(OLD);
      -- which fields changed; for a form response, which answers; for a client's checklist, which checklist items
      select array_agg(k order by k) into v_changed from (
        select k from jsonb_object_keys(r) k
        where k not in ('updated_at', 'modified_at', 'last_seen', 'answers') and (r->k) is distinct from (o->k)
        union all
        select 'answers.' || a from jsonb_object_keys(case when jsonb_typeof(r->'answers') = 'object' then r->'answers' else '{}'::jsonb end) a
        where a <> '__venue_checklist' and jsonb_typeof(o->'answers') = 'object' and (r->'answers'->a) is distinct from (o->'answers'->a)
        union all
        select 'checklist.' || c from (
          select jsonb_object_keys(coalesce(r->'answers'->'__venue_checklist', '{}'::jsonb)) c
          union select jsonb_object_keys(coalesce(o->'answers'->'__venue_checklist', '{}'::jsonb))
        ) ck
        where (jsonb_typeof(r->'answers'->'__venue_checklist') = 'object' or jsonb_typeof(o->'answers'->'__venue_checklist') = 'object')
          and (r->'answers'->'__venue_checklist'->c) is distinct from (o->'answers'->'__venue_checklist'->c)
      ) x;
      if v_changed is null then return null; end if;
      -- new values of the checklist items that changed (small ones only)
      select jsonb_object_agg(c, coalesce(r->'answers'->'__venue_checklist'->c, 'null'::jsonb)) into v_detail
      from unnest(v_changed) ch, lateral (select substr(ch, 11) c) cc
      where ch like 'checklist.%' and length(coalesce((r->'answers'->'__venue_checklist'->c)::text, '')) <= 400;
    end if;

    v_label := coalesce(
      nullif(trim(coalesce(r->>'First Name', '') || ' ' || coalesce(r->>'Last Name', '')), ''),
      r->>'name', r->>'title', r->>'event_title', r->>'visitor_name', r->>'subject', r->>'full_name',
      r->'answers'->>'__event_name', r->'answers'->>'evp_org',
      nullif(concat_ws(' + ', r->'answers'->>'7fnabd0i', r->'answers'->>'7leui2ic'), ''), r->'answers'->>'evp_name',
      r->>'label', r->>'description', r->>'area', r->>'Name');
    insert into public.portal_activity (actor_name, volunteer_id, table_name, op, row_id, label, changed, detail)
    values (v_name, v_vol, TG_TABLE_NAME, lower(TG_OP), r->>'id', left(v_label, 160), v_changed, v_detail);
  exception when others then
    null; -- never block the change itself
  end;
  return null;
end
$function$;
