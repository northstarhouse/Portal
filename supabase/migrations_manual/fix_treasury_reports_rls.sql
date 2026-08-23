-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- treasury_reports was created after this project started auto-enabling
-- Row Level Security on new tables, so it came up RLS-on with zero
-- policies -- writes were silently rejected (42501), which PostgREST
-- reports as HTTP 401, which the app's fetch handler misreads as an
-- expired login and boots you to the password screen.
--
-- This app's access control is the app-level shared password / x-app-token
-- gate, not per-row Postgres RLS (matching every other table here, e.g.
-- venue_messages, financial_reconciliations), so just turn RLS off.

alter table treasury_reports disable row level security;
