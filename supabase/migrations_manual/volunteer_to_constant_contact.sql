-- A volunteer who becomes Active or On-Call Supporter on the roster (new row, status change, or new email) is added to the
-- Constant Contact lists chosen for the Volunteer Sign Up form (Admin > Constant Contact: currently 2027 Volunteer List and
-- 2027 Email List). It uses the same import as the Portal: people who unsubscribed in Constant Contact are never re-subscribed.
-- Failures are swallowed so editing the roster is never blocked. Safe to re-run.
create or replace function public.trg_volunteer_to_cc()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(coalesce(new."Email", ''), E' \t\r\n'));
  v_old_email text;
  v_lists jsonb;
begin
  if v_email = '' or v_email !~ '^\S+@\S+\.\S+$' then return new; end if;
  if new."Status" is null or new."Status" not in ('Active', 'On-Call Supporter') then return new; end if;
  if tg_op = 'UPDATE' then
    v_old_email := lower(btrim(coalesce(old."Email", ''), E' \t\r\n'));
    if old."Status" is not distinct from new."Status" and v_old_email = v_email then return new; end if;
  end if;
  select volunteer_lists into v_lists from public.cc_connection where id = 1;
  if v_lists is null or jsonb_typeof(v_lists) <> 'array' or jsonb_array_length(v_lists) = 0 then return new; end if;
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/constant-contact',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := jsonb_build_object('action', 'import', 'source', 'Volunteer roster',
      'people', jsonb_build_array(jsonb_build_object('email', v_email, 'first', coalesce(new."First Name", ''), 'last', coalesce(new."Last Name", ''))),
      'lists', v_lists),
    timeout_milliseconds := 30000
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists volunteer_to_cc on public."2026 Volunteers";
create trigger volunteer_to_cc after insert or update of "Status", "Email" on public."2026 Volunteers"
  for each row execute function public.trg_volunteer_to_cc();
