-- Run this once in the Supabase SQL editor.
-- Lets docents mark a tour request's status from Volunteer Hub (Scheduled
-- Tour / Contact Made / Dates Not Workable), separate from the generic
-- "handled" checkbox Portal's Form Responses browser already uses on
-- nsh_form_responses.status -- a dedicated column avoids the two features
-- stepping on each other.

alter table nsh_form_responses add column if not exists tour_status text;
