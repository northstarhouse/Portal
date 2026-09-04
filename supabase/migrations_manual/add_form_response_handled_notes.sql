-- Run this once in the Supabase SQL editor.
-- Adds staff-only "handled" status + internal notes to individual form
-- responses (nsh_form_responses), so admins can check off a response once
-- it's been dealt with and leave a note for other staff.

alter table nsh_form_responses add column if not exists status text;
alter table nsh_form_responses add column if not exists internal_notes text;
