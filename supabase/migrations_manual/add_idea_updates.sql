-- Run this once in the Supabase SQL editor.
-- Backs the new multi-entry, dated "Updates" list on Ideas & Initiatives
-- (replacing the old single free-text "updates" column on "Ideas", which
-- stays in place but is no longer edited from the UI).

create table if not exists idea_updates (
  id          bigint generated always as identity primary key,
  idea_id     bigint not null,
  update_date date not null default current_date,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idea_updates_idea_id_idx on idea_updates (idea_id);

alter table idea_updates enable row level security;

create policy "public read"   on idea_updates for select using (true);
create policy "public insert" on idea_updates for insert with check (true);
create policy "public update" on idea_updates for update using (true);
create policy "public delete" on idea_updates for delete using (true);
