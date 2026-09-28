-- Run this once in the Supabase SQL editor.
-- kiosk_logs (check-in/check-out pairs that back both the kiosk device and
-- Volunteer Hub's "Add Missed Hours" self-service form) had no free-text
-- field at all -- no way to record what an entry was actually for. Adds an
-- optional notes column so manually-logged hours (and, later, kiosk entries)
-- can carry a short description.

alter table kiosk_logs add column if not exists notes text;
