-- Run once in the Supabase SQL editor.
-- Records whose account marked a requested tour date as handled (e.g. Jen or Derek).
alter table estate_tours add column if not exists request_handled_by text;
