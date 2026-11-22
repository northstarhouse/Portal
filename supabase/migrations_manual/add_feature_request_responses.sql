-- Responses to a feature request or bug report, kept on the request itself: a list of { text, by, at }, oldest first.
-- Written from Tools > Make a feature request > Respond. Same access as the rest of feature_requests (signed-in Portal session). Safe to re-run.
alter table public.feature_requests add column if not exists responses jsonb not null default '[]'::jsonb;
