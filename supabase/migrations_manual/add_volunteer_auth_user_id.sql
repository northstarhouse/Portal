-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Links each volunteer to their Supabase Auth account (used by the separate Volunteer Hub app,
-- which shares this same Supabase project's Auth), matched by email. "Op Budget" already had a
-- volunteer_auth_user_id column ready to receive this -- this is the other end of that link.

alter table "2026 Volunteers"
  add column if not exists auth_user_id uuid;

-- One-time backfill for volunteers who already have a matching Auth account.
-- Safe to re-run: only touches rows where the match differs from what's stored.
update "2026 Volunteers" v
  set auth_user_id = u.id
  from auth.users u
  where lower(v."Email") = lower(u.email)
    and v.auth_user_id is distinct from u.id;

-- The Portal now attaches this to Op Budget.volunteer_auth_user_id whenever staff pick a
-- volunteer from a "Reimburse To" picker (not the free-text reimbursement-edit field), so the
-- Volunteer Hub can later look up "my reimbursements" by the logged-in user's own auth id.
-- Going forward, whichever app a volunteer first authenticates in should keep this column
-- current for that volunteer (e.g. re-run the backfill above, or set it directly on signup).
