-- A phone number for the person who sent a message, shown beside their name on the Messages tab.
alter table public.venue_messages add column if not exists from_phone text;
