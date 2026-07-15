-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Adds "Purchased By" (all areas) and "Event Name" (Events area) fields to budget entries.

alter table "Op Budget"
  add column if not exists purchased_by text,
  add column if not exists event_name text;
