-- Notes on Tools > Activity log: staff notes about a person (Derek, Jen, Haley).
-- Who wrote a note is never typed: a trigger stamps it from the signed-in Portal session (x-app-token),
-- so it always says who was logged in. Editing a note keeps the original author and records who edited it and when.
-- app_session_name() also lets the Portal show "Signed in as ..." and fill in names elsewhere.
-- Apply one statement at a time.

create table if not exists public.portal_notes (
  id bigserial primary key,
  about_person text not null,
  body text not null,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by text
);

alter table public.portal_notes enable row level security;

create policy "portal session read portal_notes" on public.portal_notes for select to anon using (public.has_valid_app_session());

create policy "portal session insert portal_notes" on public.portal_notes for insert to anon with check (public.has_valid_app_session());

create policy "portal session update portal_notes" on public.portal_notes for update to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

create policy "portal session delete portal_notes" on public.portal_notes for delete to anon using (public.has_valid_app_session());

grant select, insert, update, delete on public.portal_notes to anon;

grant usage, select on sequence public.portal_notes_id_seq to anon;

-- The signed-in person's name for this request (null when not signed in).
CREATE OR REPLACE FUNCTION public.app_session_name()
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select s.actor_name from public.app_sessions s
  where s.token = nullif(current_setting('request.headers', true)::json->>'x-app-token', '') and s.expires_at > now()
  limit 1
$function$;

grant execute on function public.app_session_name() to anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_notes_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_name text := public.app_session_name();
begin
  if TG_OP = 'INSERT' then
    new.author_name := coalesce(v_name, new.author_name, 'Unknown');
    new.created_at := now();
    new.updated_at := null; new.updated_by := null;
  else
    new.author_name := old.author_name;
    new.created_at := old.created_at;
    if new.body is distinct from old.body or new.about_person is distinct from old.about_person then
      new.updated_at := now();
      new.updated_by := coalesce(v_name, 'Unknown');
    else
      new.updated_at := old.updated_at; new.updated_by := old.updated_by;
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists portal_notes_stamp on public.portal_notes;

create trigger portal_notes_stamp before insert or update on public.portal_notes for each row execute function public.portal_notes_stamp();

-- Notes now attach to one Activity log entry (item_ref) instead of the person as a whole.
alter table public.portal_notes add column if not exists item_ref text;
