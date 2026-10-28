-- Lets an Events Committee event be hidden from the event cards (dashboard + Events Committee page).
-- The event and everything planned for it are kept; it can be shown again from the Events Committee page.
alter table events_committee add column if not exists hidden boolean not null default false;

-- Hide Game Day at North Star House #2 now.
update events_committee set hidden = true where name = 'Game Day at North Star House #2';
