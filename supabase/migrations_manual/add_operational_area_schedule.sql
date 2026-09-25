-- Run this once in the Supabase SQL editor.
-- Adds a free-text recurring-schedule field per Operational Area (e.g.
-- "Every Tuesday & Thursday, 9am-12pm"), editable from Admin -> Operational
-- Budgets alongside lead/lead_email/budget. Used in the Volunteer Interest
-- Form's "Email Volunteer" thank-you email to tell applicants when their
-- area of interest actually meets.

alter table operational_area_budgets add column if not exists schedule text;
