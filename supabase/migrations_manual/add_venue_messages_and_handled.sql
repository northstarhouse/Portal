-- Run once in the Supabase SQL editor. (Replaces add_venue_messages_handled.sql, which assumed this table already existed.)
-- Venue Rentals > Messages: staff-logged correspondence, plus messages couples send from their event page.
-- Event-page messages show in Needs your attention until staff mark them handled.
create table if not exists venue_messages (
  id bigint generated always as identity primary key,
  event_uid text,          -- a calendar UID, or 'client:<pre-booking id>' for a message sent from a couple's event page
  event_title text,        -- snapshot of the wedding/event title at the time, so old messages still read fine
  subject text,
  body text not null,
  from_name text,
  from_email text,
  direction text not null default 'incoming' check (direction in ('incoming', 'outgoing')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table venue_messages add column if not exists handled_at timestamptz;
create index if not exists venue_messages_event_uid_idx on venue_messages(event_uid);
create index if not exists venue_messages_created_at_idx on venue_messages(created_at desc);

-- Staff signed in to the Portal can read, add and update; nobody else can.
alter table venue_messages enable row level security;
drop policy if exists "venue_messages staff select" on venue_messages;
drop policy if exists "venue_messages staff insert" on venue_messages;
drop policy if exists "venue_messages staff update" on venue_messages;
create policy "venue_messages staff select" on venue_messages for select to anon, authenticated using (has_valid_app_session());
create policy "venue_messages staff insert" on venue_messages for insert to anon, authenticated with check (has_valid_app_session());
create policy "venue_messages staff update" on venue_messages for update to anon, authenticated using (has_valid_app_session()) with check (has_valid_app_session());
