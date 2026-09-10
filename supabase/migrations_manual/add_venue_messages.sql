-- Run this once in the Supabase SQL editor.
-- Backs the new "Messages" section on the Venue Rentals dashboard.
-- There is no existing inbox/CRM integration for rental correspondence —
-- this is a manual, staff-logged correspondence record (not an automated
-- pull from email) until a real messaging pipeline is connected. See the
-- note in VenueMessagesView in src/app.jsx.
create table if not exists venue_messages (
  id bigint generated always as identity primary key,
  event_uid text,          -- optional link to a venue_wedding_tracking.event_uid / calendar UID
  event_title text,        -- snapshot of the wedding/event title at time of logging, so old messages still read fine if the calendar entry changes
  subject text,
  body text not null,
  from_name text,
  from_email text,
  direction text not null default 'incoming' check (direction in ('incoming', 'outgoing')),
  created_at timestamptz not null default now()
);
create index if not exists venue_messages_event_uid_idx on venue_messages(event_uid);
create index if not exists venue_messages_created_at_idx on venue_messages(created_at desc);
