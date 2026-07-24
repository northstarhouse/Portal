-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Links each volunteer to their Supabase Auth account (used by the separate Volunteer Hub app,
-- which shares this same Supabase project's Auth), matched by email. "Op Budget" already had a
-- volunteer_auth_user_id column ready to receive this -- this is the other end of that link.

alter table "2026 Volunteers"
  add column if not exists auth_user_id uuid;

-- One-time backfill for volunteers who already have a matching Auth account.
-- Safe to re-run: only touches rows where the match differs from what's stored.
-- Strips ALL whitespace (not just leading/trailing spaces -- plain trim() doesn't touch
-- embedded \r\n, which a couple of volunteer records had) before comparing, since a handful
-- of stored emails had stray whitespace that silently broke a plain lower(email) match.
update "2026 Volunteers" v
  set auth_user_id = u.id
  from auth.users u
  where lower(regexp_replace(v."Email", '\s+', '', 'g')) = lower(regexp_replace(u.email, '\s+', '', 'g'))
    and v.auth_user_id is distinct from u.id;

-- The Portal now attaches this to Op Budget.volunteer_auth_user_id whenever staff pick a
-- volunteer from a "Reimburse To" picker (not the free-text reimbursement-edit field), so the
-- Volunteer Hub can later look up "my reimbursements" by the logged-in user's own auth id.
-- Going forward, whichever app a volunteer first authenticates in should keep this column
-- current for that volunteer (e.g. re-run the backfill above, or set it directly on signup).

-- 2026-07-24: bulk-created auth.users accounts ahead of the Volunteer Hub launch for every
-- volunteer with an email who didn't already have one (29 created; 71 already existed), all with
-- the shared initial password "1905" and email_confirm=true, no invite/notification email sent
-- (done via the GoTrue Admin API, not SQL -- not reproducible from this file). Force a password
-- change on first real login once the Hub launches, since the initial password is shared/guessable.
