-- Run this once in the Supabase SQL editor.
-- The "new form responses" unread badge was tracked per-browser in
-- localStorage, with a comment noting the Portal has one shared login, not
-- per-user accounts. In practice that meant every staff member's browser
-- showed its own independent unread count, and one person opening a form's
-- responses never cleared the badge for anyone else. Moves the "last seen"
-- state into Supabase so it's shared across everyone using the Portal.

create table if not exists form_responses_seen (
  form_id uuid primary key references nsh_forms(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table form_responses_seen enable row level security;
create policy "public select" on form_responses_seen for select using (true);
create policy "public insert" on form_responses_seen for insert with check (true);
create policy "public update" on form_responses_seen for update using (true) with check (true);

-- Backfill so existing/already-reviewed responses don't all flood in as
-- "unread" the moment this ships -- only submissions from here on count.
insert into form_responses_seen (form_id, last_seen_at)
select id, now() from nsh_forms
on conflict (form_id) do nothing;
