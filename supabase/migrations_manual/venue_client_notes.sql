-- Internal (staff-only) notes about a couple, kept by email so the same notes show on their client profile and on the
-- Following page. The database stamps who wrote / edited each note. Apply one statement at a time.

create table if not exists public.venue_client_notes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz
);

create index if not exists venue_client_notes_email_idx on public.venue_client_notes (email, created_at);

alter table public.venue_client_notes enable row level security;

create policy "portal session all venue_client_notes" on public.venue_client_notes for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

grant select, insert, update, delete on public.venue_client_notes to anon;

CREATE OR REPLACE FUNCTION public.venue_client_notes_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(public.app_session_name(), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(public.app_session_name(), new.updated_by);
  end if;
  return new;
end
$function$;

drop trigger if exists venue_client_notes_stamp on public.venue_client_notes;

create trigger venue_client_notes_stamp before insert or update on public.venue_client_notes for each row execute function public.venue_client_notes_stamp();

insert into public.venue_client_notes (email, body, created_by, created_at)
select email, note, follower, created_at from public.venue_follows where coalesce(trim(note), '') <> '';
