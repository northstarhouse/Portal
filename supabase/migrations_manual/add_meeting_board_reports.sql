-- Run this once in the Supabase SQL editor.
-- Backs the new "Meeting & Board Reports" main nav tab (MeetingBoardReportsView
-- in src/app.jsx) -- a simple list of meeting minutes / board report links.

create table if not exists meeting_board_reports (
  id           uuid default gen_random_uuid() primary key,
  title        text not null,
  meeting_date date,
  url          text,
  notes        text,
  created_at   timestamptz default now()
);

alter table meeting_board_reports enable row level security;

create policy "public read"   on meeting_board_reports for select using (true);
create policy "public insert" on meeting_board_reports for insert with check (true);
create policy "public update" on meeting_board_reports for update using (true);
create policy "public delete" on meeting_board_reports for delete using (true);
