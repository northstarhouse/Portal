-- Notes on messages say who wrote them: whenever a message's note changes, the signed-in Portal person (app_session_name())
-- and the time are stamped on it. Used by Messages > Past messages, where notes can be added and edited later.
-- Apply one statement at a time.

alter table public.venue_messages add column if not exists handled_note_by text;

alter table public.venue_messages add column if not exists handled_note_at timestamptz;

CREATE OR REPLACE FUNCTION public.venue_messages_note_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.handled_note is distinct from old.handled_note then
    new.handled_note_by := coalesce(public.app_session_name(), new.handled_by, old.handled_note_by);
    new.handled_note_at := now();
  end if;
  return new;
end
$function$;

drop trigger if exists venue_messages_note_stamp on public.venue_messages;

create trigger venue_messages_note_stamp before update on public.venue_messages for each row execute function public.venue_messages_note_stamp();
