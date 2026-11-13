-- Following: the tour guide automatically follows every couple they tour. When an estate tour is booked (or its guide
-- or visitor email changes), the guide (e.g. "Derek" -> "Derek Cheeseman", matched to the Portal sign-in names)
-- follows the visitor's email. Unfollowing sticks: a follow is only added when the tour is booked or reassigned.
-- Also backfills the last 90 days and all upcoming booked tours. Apply one statement at a time.

CREATE OR REPLACE FUNCTION public.venue_follows_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'INSERT' then
    new.follower := coalesce(nullif(trim(new.follower), ''), public.app_session_name());
    new.created_at := now();
  else
    new.follower := old.follower;
  end if;
  if coalesce(new.follower, '') = '' then raise exception 'Sign in to follow a couple'; end if;
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.guide_full_name(p_guide text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select s.actor_name from public.app_sessions s
  where s.actor_name is not null and lower(split_part(trim(s.actor_name), ' ', 1)) = lower(trim(p_guide))
  order by s.expires_at desc nulls last limit 1
$function$;

CREATE OR REPLACE FUNCTION public.auto_follow_toured_couple()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  who text;
begin
  if new.status is distinct from 'booked' or new.visitor_email is null or trim(new.visitor_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or coalesce(trim(new.guide_name), '') in ('', 'default') or coalesce(new.category, '') ilike 'test' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status and old.guide_name is not distinct from new.guide_name
     and lower(trim(coalesce(old.visitor_email, ''))) = lower(trim(new.visitor_email)) then
    return new;
  end if;
  who := public.guide_full_name(new.guide_name);
  if who is null then return new; end if;
  begin
    insert into public.venue_follows (follower, email, name, note)
    values (who, lower(trim(new.visitor_email)), nullif(trim(new.visitor_name), ''), null)
    on conflict (follower, email) do nothing;
  exception when others then
    raise warning 'auto_follow_toured_couple failed: %', sqlerrm;
  end;
  return new;
end
$function$;

drop trigger if exists trg_auto_follow_toured_couple on public.estate_tours;

create trigger trg_auto_follow_toured_couple after insert or update of status, guide_name, visitor_email on public.estate_tours for each row execute function public.auto_follow_toured_couple();

insert into public.venue_follows (follower, email, name)
select distinct on (g.who, lower(trim(t.visitor_email))) g.who, lower(trim(t.visitor_email)), nullif(trim(t.visitor_name), '')
from public.estate_tours t
cross join lateral (select public.guide_full_name(t.guide_name) as who) g
where t.status = 'booked' and t.date >= current_date - 90 and g.who is not null
  and t.visitor_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and coalesce(t.category, '') not ilike 'test'
order by g.who, lower(trim(t.visitor_email)), t.date desc
on conflict (follower, email) do nothing;
