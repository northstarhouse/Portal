-- Marks an event as RSVP-only (no ticket sales). Event cards then show an RSVP tag instead of earnings,
-- and the ticket-sales stats/section are replaced by an RSVP count.
alter table event_overview_cards add column if not exists rsvp_only boolean not null default false;
