-- Run this once in the Supabase SQL editor
-- Adds a "role" field to Event Feedback (e.g. Guest, Vendor, Volunteer),
-- shown in the entry title next to the reviewer's name.

alter table "Event Feedback"
  add column if not exists role text;
