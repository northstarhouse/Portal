-- Portal sign-in with Volunteer Hub accounts.
-- A person signs in with their Volunteer Hub email + password (Supabase Auth); this function then
-- hands back the same kind of Portal session token that the shared password used to issue, so every
-- existing RLS policy and edge function (x-app-token) keeps working unchanged.
--
-- Who gets a Portal session: an Active volunteer whose Team includes Staff, Board Member or Team Lead,
-- linked to the signed-in account through volunteer_auth_links (or, failing that, by confirmed email).
-- Returns NULL for anyone else.

create or replace function public.issue_app_session(p_user_agent text default null)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_vol bigint;
  v_team text;
  v_status text;
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

  select v."Team", v."Status" into v_team, v_status from public."2026 Volunteers" v where v.id = v_vol;
  if coalesce(v_status, '') <> 'Active' then return null; end if;
  if not exists (
    select 1 from regexp_split_to_table(coalesce(v_team, ''), '[|,]') t
    where lower(trim(t)) in ('staff', 'board member', 'team lead')
  ) then return null; end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.app_sessions (token, expires_at, user_agent)
  values (v_token, now() + interval '30 days', p_user_agent);
  return v_token;
end
$$;

revoke all on function public.issue_app_session(text) from public, anon;
grant execute on function public.issue_app_session(text) to authenticated;

-- NOT run automatically: once everyone has signed in with their Hub account, turn the old shared
-- password off with:
--   update public.app_passwords set active = false;
