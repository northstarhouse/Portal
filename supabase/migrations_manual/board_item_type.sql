-- Board Communication & Voting: what kind of item is it? NULL / 'Vote' = a normal Yes/No/Abstain vote.
-- Other values: Question, Flag, Discussion, FYI (open-ended; members just write a response).
alter table "Board Voting Items" add column if not exists item_type text;
