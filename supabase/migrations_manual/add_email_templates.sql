-- Run this once in the Supabase SQL editor.
-- Saved templates for the "Template Email" tool (Volunteer Email Lists),
-- so a subject/headline/body/button combo can be reused for a future send
-- instead of retyped from scratch each time.

create table if not exists email_templates (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  subject     text,
  headline    text,
  subtext     text,
  button_text text,
  button_url  text,
  note        text,
  created_at  timestamptz default now()
);

alter table email_templates enable row level security;

create policy "public read"   on email_templates for select using (true);
create policy "public insert" on email_templates for insert with check (true);
create policy "public update" on email_templates for update using (true);
create policy "public delete" on email_templates for delete using (true);
