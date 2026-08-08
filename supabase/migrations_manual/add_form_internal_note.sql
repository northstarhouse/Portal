-- Run this once in the Supabase SQL editor.
-- Adds a staff-only note to nsh_forms, separate from `description` (which is
-- the public secondary line shown on the form itself). This note only ever
-- appears in the Form Builder's list view, never on the public form.

alter table nsh_forms add column if not exists internal_note text;
