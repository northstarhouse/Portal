-- Run this once in the Supabase SQL editor.
-- Adds a category column (Planning / Events / Development / etc.) to
-- meeting_board_reports, backing the per-month quick-upload buttons on the
-- Meeting & Board Reports tab.

alter table meeting_board_reports add column if not exists category text;
