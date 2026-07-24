-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Lets each event in Venue Rentals track a total booked cost (manually entered,
-- e.g. from the HoneyBook "Booked amount" column) alongside the existing
-- pictures/blog/socials tracking fields.

alter table venue_wedding_tracking add column if not exists total_cost numeric;
