-- Events Committee: the website event form (photo, web address, location, ticket types) and the link to the
-- website event made by "Push to website".
alter table events_committee add column if not exists ticket_tiers jsonb not null default '[]'::jsonb;
alter table events_committee add column if not exists site_event_id uuid;
alter table events_committee add column if not exists website jsonb not null default '{}'::jsonb;
