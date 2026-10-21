-- Replace the binary Handled/Not Handled dropdown on venue Tour Requests with
-- a richer status: Not Handled / Made Contact. Made Contact starts a 30-day
-- clock; once it's passed, the request fades out of the active list into a
-- collapsed Archived section in the Portal (estate_tours.status stays
-- 'requested' the whole time -- this is a UI-only fade, not a status change,
-- so nothing else that reads status is affected).
alter table estate_tours
  add column if not exists request_status text not null default 'not_handled'
    check (request_status in ('not_handled', 'made_contact')),
  add column if not exists made_contact_at timestamptz;

update estate_tours
set request_status = 'made_contact', made_contact_at = now()
where request_handled = true and request_status = 'not_handled';
