-- Run this once in the Supabase SQL editor.
-- The "Schedule" field added in add_operational_area_schedule.sql turned out
-- too narrow -- staff want to craft the actual volunteer welcome copy per
-- area (tone, what the work involves, meeting times, whatever), not just a
-- one-line schedule. Renaming in place since no data had been entered yet.

alter table operational_area_budgets rename column schedule to volunteer_message;
