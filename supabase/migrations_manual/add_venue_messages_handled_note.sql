-- Run once in the Supabase SQL editor.
-- A notes box when a message is handled (what was done, what was said, next steps).
alter table venue_messages add column if not exists handled_note text;
