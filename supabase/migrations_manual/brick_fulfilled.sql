-- Brick Orders Wording: mark a brick as fulfilled (engraved / installed). One row per brick, keyed like the list
-- ('o<order id>' website order, 'd<donation id>' entered by hand, 'w<inquiry id>' venue rental legacy brick).
create table if not exists public.brick_fulfilled (
  key text primary key,
  fulfilled_at timestamptz not null default now(),
  fulfilled_by text
);
alter table public.brick_fulfilled enable row level security;
drop policy if exists brick_fulfilled_all on public.brick_fulfilled;
create policy brick_fulfilled_all on public.brick_fulfilled for all to anon, authenticated using (true) with check (true);
