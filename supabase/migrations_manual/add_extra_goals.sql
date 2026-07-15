-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Adds support for goals beyond the fixed goal_1/goal_2/goal_3 columns.

alter table "Op Quarter Goals"
  add column if not exists extra_goals jsonb default '[]'::jsonb,
  add column if not exists extra_goals_status jsonb default '[]'::jsonb,
  add column if not exists extra_goals_summary jsonb default '[]'::jsonb;

alter table "Op Quarterly Updates"
  add column if not exists extra_goals jsonb default '[]'::jsonb,
  add column if not exists extra_goals_status jsonb default '[]'::jsonb,
  add column if not exists extra_goals_summary jsonb default '[]'::jsonb;
