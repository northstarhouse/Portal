-- Board Communication: decisions entered from the board meeting minutes.
-- Only the outcome is kept (a result and, where the minutes give it, the vote count). There are no individual votes for these.
alter table "Board Voting Items" add column if not exists decision text;         -- the result, e.g. 'Approved'
alter table "Board Voting Items" add column if not exists decision_detail text;  -- e.g. '5 in favor, 1 abstention'

-- Added oldest first and, within one meeting, last item first, so the list (newest on top) reads in the order of the minutes.
-- Each is skipped if an item with that title is already there, so running this again adds nothing.
-- Left out because the portal already has them, with their votes: the volunteer caps ($1,200) and the rock installation ($1,500).

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve Creative Rentals fee schedule', 'Closed', date '2025-12-18', 'Approved', null, false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve Creative Rentals fee schedule'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Elect Wyn Spiller as Treasurer', 'Closed', date '2025-12-18', 'Approved', null, false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Elect Wyn Spiller as Treasurer'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Elect Paula Campbell as Secretary', 'Closed', date '2025-12-18', 'Approved', null, false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Elect Paula Campbell as Secretary'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Elect Ken Underwood as Board President', 'Closed', date '2025-12-18', 'Approved', null, false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Elect Ken Underwood as Board President'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve wedding pricing schedule', 'Closed', date '2026-01-15', 'Approved', 'All in favor', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve wedding pricing schedule'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve Teichert Foundation grant application', 'Closed', date '2026-01-15', 'Approved', 'All in favor', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve Teichert Foundation grant application'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve Interiors policies, gift acceptance policies, protocols, and associated forms', 'Closed', date '2026-01-15', 'Approved', '5 in favor, 1 abstention', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve Interiors policies, gift acceptance policies, protocols, and associated forms'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve CLORE fire-retardant system', 'Closed', date '2026-08-20', 'Approved', 'All in favor', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve CLORE fire-retardant system'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve 2026 cash budget', 'Closed', date '2026-08-20', 'Approved', '5 in favor, 1 abstention', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve 2026 cash budget'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Waive rental fee for Diana Cushway''s dance/workout event benefiting Sammie''s Friends auction ($600 value)', 'Closed', date '2026-09-17', 'Approved', 'All in favor, including proxy', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Waive rental fee for Diana Cushway''s dance/workout event benefiting Sammie''s Friends auction ($600 value)'));

insert into "Board Voting Items" (title, status, meeting_date, decision, decision_detail, allow_notes_vote)
select 'Approve historical document archiving project with Searles Library, with contract subject to subsequent board approval', 'Closed', date '2026-10-15', 'Approved', 'All in favor', false
where not exists (select 1 from "Board Voting Items" where lower(title) = lower('Approve historical document archiving project with Searles Library, with contract subject to subsequent board approval'));
