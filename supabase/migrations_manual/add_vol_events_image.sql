-- Lets an RSVP / sign-up event carry an image (shown on its public form).
-- Files go in the existing public "event-flyers" storage bucket.
alter table vol_events add column if not exists image_url text;
