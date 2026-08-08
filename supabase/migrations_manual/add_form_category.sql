-- Run this once in the Supabase SQL editor.
-- Adds a category flag to nsh_forms so forms can be tagged (Wedding, Volunteer,
-- Website, Board) — the basis for grouping forms into tabs in the Form Builder.

alter table nsh_forms add column if not exists category text;
