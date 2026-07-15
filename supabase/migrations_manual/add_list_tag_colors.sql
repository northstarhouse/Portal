-- Run this once in the Supabase SQL editor
-- Stores a chosen pill color per volunteer "Custom List" tag, so admins
-- can pick a color when creating/editing a list instead of always
-- getting the default blue.

create table if not exists "List Tag Colors" (
  tag text primary key,
  color text not null default '#0d6eab'
);
