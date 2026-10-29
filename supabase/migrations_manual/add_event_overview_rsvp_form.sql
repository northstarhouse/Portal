-- Ties an RSVP-only event to the specific RSVP form (vol_events, event_type 'rsvp') whose responses it should read.
-- Used by the RSVP panel on the Events Committee page and Event Overviews (Hub and Portal).
alter table event_overview_cards add column if not exists rsvp_event_id uuid references vol_events(id) on delete set null;
