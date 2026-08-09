-- Run this once in the Supabase SQL editor.
-- Announcement board shown on the Volunteer Hub dashboard, under Hours.
-- Each post can carry a flyer image and/or text, an optional expiration date
-- (hidden from the Hub once past), and an optional RSVP-style button
-- (button_text + button_url).

create table if not exists announcements (
  id          uuid default gen_random_uuid() primary key,
  text        text,
  image_url   text,
  expires_at  date,
  button_text text,
  button_url  text,
  created_at  timestamptz default now()
);

alter table announcements enable row level security;

create policy "public read"   on announcements for select using (true);
create policy "public insert" on announcements for insert with check (true);
create policy "public update" on announcements for update using (true);
create policy "public delete" on announcements for delete using (true);
