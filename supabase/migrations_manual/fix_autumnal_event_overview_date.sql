-- The overview card was undated even though both the committee event and
-- In-House Events confirm October 17. Volunteer Hub cannot depend on the
-- Portal-only In-House Events read policy to supply its missing card date.
-- Preserve any explicit date that has already been set on the overview.
update public.event_overview_cards as card
set event_date = event.date,
    updated_at = now()
from public.events_committee as event
where card.id = 1
  and card.event_name = 'An Autumnal Evening in Another Era'
  and card.event_date is null
  and event.id = '66998a9d-03cb-4629-8842-844dee690750'
  and event.name = card.event_name
  and event.date = date '2026-10-17';
