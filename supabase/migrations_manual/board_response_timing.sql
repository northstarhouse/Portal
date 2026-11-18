-- Board Communication & Voting: when a reply is wanted on a non-vote item.
-- NULL = no response needed; 'asap'; 'next_meeting'; 'date' (the date is stored in due_date).
alter table "Board Voting Items" add column if not exists response_timing text;
