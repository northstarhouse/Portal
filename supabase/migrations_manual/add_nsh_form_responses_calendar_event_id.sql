-- Run this once in the Supabase SQL editor.
-- "Add Scheduled Docent Tour to Calendar" (Volunteer Hub's TourRequestsCard)
-- only remembered a successful add in that component's own local state, so
-- the button reverted to "+ Add to Calendar" on the next page load/refresh
-- even after the event was already created -- there was nowhere to persist
-- it. Storing the created Google Calendar event id on the submission itself
-- lets the button show "Added to Calendar" permanently once it's done.

alter table nsh_form_responses add column if not exists calendar_event_id text;
