-- "Marketing not applicable" for an event: the Marketing Checklist (Event Overviews) and the
-- Marketing & Promotion section (Events Committee planning page) show N/A instead of a to-do list.
alter table event_overview_cards add column if not exists marketing_na boolean not null default false;
