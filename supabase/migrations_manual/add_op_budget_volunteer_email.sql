-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Adds volunteer_email to "Op Budget" so a Portal-submitted reimbursement carries a matchable
-- email even before the volunteer has signed into the Volunteer Hub (and therefore has no
-- auth_user_id yet) -- the same email the Hub will later match against auth.users on signup.

alter table "Op Budget"
  add column if not exists volunteer_email text;
