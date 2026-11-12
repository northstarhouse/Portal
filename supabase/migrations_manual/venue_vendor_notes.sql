-- Internal (staff-only) notes on the preferred vendors. Kept in their own table because venue_vendors is publicly readable
-- (it feeds the client guidebooks); these notes are only visible with a signed-in Portal session.
-- Apply one statement at a time.

create table if not exists public.venue_vendor_notes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.venue_vendors(id) on delete cascade,
  body text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz
);

create index if not exists venue_vendor_notes_vendor_idx on public.venue_vendor_notes (vendor_id, created_at);

alter table public.venue_vendor_notes enable row level security;

create policy "portal session all venue_vendor_notes" on public.venue_vendor_notes for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

grant select, insert, update, delete on public.venue_vendor_notes to anon;

CREATE OR REPLACE FUNCTION public.venue_vendor_notes_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
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

drop trigger if exists venue_vendor_notes_stamp on public.venue_vendor_notes;

create trigger venue_vendor_notes_stamp before insert or update on public.venue_vendor_notes for each row execute function public.venue_vendor_notes_stamp();
