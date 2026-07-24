-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Lets a volunteer profile be linked to a donor profile (same person supports NSH both ways).

alter table "2026 Volunteers" add column if not exists donor_id uuid references donors(id) on delete set null;

create index if not exists idx_2026_volunteers_donor_id on "2026 Volunteers"(donor_id);
