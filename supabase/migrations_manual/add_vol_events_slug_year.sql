-- Event short links now end with the event's year:  ?e=state-of-the-star-2026
-- (so a yearly event can be reused without its link colliding). Undated events keep a plain slug.
-- Replaces the helpers from add_vol_events_slug.sql and re-names the existing events.

drop function if exists vol_event_make_slug(text, uuid);

create or replace function vol_event_make_slug(p_title text, p_date text, p_id uuid)
returns text
language plpgsql
as $$
declare
  base text;
  yr text := substring(coalesce(p_date, '') from '^\d{4}');
  cand text;
  n int := 1;
begin
  base := trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'event'; end if;
  -- don't double the year if the title already ends with it
  if yr is not null and base !~ ('-' || yr || '$') then base := base || '-' || yr; end if;
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
    new.slug := vol_event_make_slug(new.title, new.date, new.id);
  end if;
  return new;
end
$$;

do $$
declare r record;
begin
  for r in select id, title, date from vol_events order by created_at, id loop
    update vol_events set slug = vol_event_make_slug(r.title, r.date, r.id) where id = r.id;
  end loop;
end
$$;
