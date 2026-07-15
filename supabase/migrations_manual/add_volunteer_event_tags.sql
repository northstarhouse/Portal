-- Run this once in the Supabase SQL editor
-- Adds an "Event Tags" field to volunteers, separate from "Team", for tagging
-- volunteers who worked a specific event (e.g. "Volunteered for: Fall Gala").
-- Stored the same way as "Team": a single text column, values separated by " | ".

alter table "2026 Volunteers"
  add column if not exists "Event Tags" text;
