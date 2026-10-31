-- Run once in the Supabase SQL editor.
-- Lets a tour request be set to "Not Interested" (it goes straight to the archive).
-- request_handled_by is also needed when a cancelled tour's slot is reopened.
alter table estate_tours add column if not exists request_handled_by text;
alter table estate_tours drop constraint if exists estate_tours_request_status_check;
alter table estate_tours add constraint estate_tours_request_status_check
  check (request_status in ('not_handled', 'made_contact', 'not_interested'));
