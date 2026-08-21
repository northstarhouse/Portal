-- Run this once in the Supabase SQL editor.
-- Tracks Accept/Deny for "Submitted for Review" items on the Meeting &
-- Board Reports tab. Null = pending, 'Accepted', 'Denied'. A "Next
-- Meeting" action doesn't set this -- it moves the item to the Agenda
-- category for next month instead (see the app's handleReviewAction).

alter table meeting_board_reports add column if not exists review_status text;
