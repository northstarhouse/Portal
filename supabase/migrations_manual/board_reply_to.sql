-- Board Communication & Voting: threaded replies on non-vote items. NULL = top-level comment.
alter table "Board-Votes" add column if not exists reply_to bigint;
