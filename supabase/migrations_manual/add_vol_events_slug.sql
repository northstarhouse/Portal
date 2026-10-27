-- Short, readable links for RSVP / sign-up events:  .../NSH-forms/?e=state-of-the-star
-- (the old ?view=event&id=state-of-the-star__<uuid> links keep working).
-- A slug is made from the title once, when the event is created, and never changes after that,
-- so a shared link doesn't break if the title is edited later.

alter table vol_events add column if not exists slug text;

create or replace function vol_event_make_slug(p_title text, p_id uuid)
returns text
language plpgsql
as $$
declare
  base text;
  cand text;
  n int := 1;
begin
  base := trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'event'; end if;
  cand := base;
  while exists (select 1 from vol_events where slug = cand and id <> p_id) loop
    n := n + 1;
    cand := base || '-' || n;
  end loop;
  return cand;
end
$$;

create or replace function vol_events_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := vol_event_make_slug(new.title, new.id);
  end if;
  return new;
end
$$;

drop trigger if exists vol_events_set_slug_trg on vol_events;
create trigger vol_events_set_slug_trg
before insert on vol_events
for each row execute function vol_events_set_slug();

-- Give every existing event a slug (oldest first, so the oldest keeps the plain name).
do $$
declare r record;
begin
  for r in select id, title from vol_events where slug is null order by created_at, id loop
    update vol_events set slug = vol_event_make_slug(r.title, r.id) where id = r.id;
  end loop;
end
$$;

create unique index if not exists vol_events_slug_key on vol_events (slug);
