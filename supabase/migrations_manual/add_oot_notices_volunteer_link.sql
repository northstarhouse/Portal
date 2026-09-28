-- Run this once in the Supabase SQL editor.
-- oot_notices was purely name-based (no link back to "2026 Volunteers"), so
-- staff couldn't submit or view a notice tied to a specific volunteer's
-- profile the way reimbursements already are (volunteer_id + auth_user_id).
-- Adds the same pair of columns here so Out of Town notices can be tied
-- the same way, from either the Portal (staff, on someone's behalf) or
-- Volunteer Hub (self-submitted).

alter table oot_notices add column if not exists volunteer_id bigint references "2026 Volunteers"(id) on delete set null;
alter table oot_notices add column if not exists auth_user_id uuid;
