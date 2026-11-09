-- RSVP events can ask "Are you a member or a sponsor?" and, for sponsors, the organization name. Safe to re-run.
--   vol_events.ask_affiliation        turn the question on for an event (Form Builder > Events > edit)
--   vol_event_responses.affiliation   'member' | 'sponsor' | 'guest'
--   vol_event_responses.organization  the sponsor's organization name
alter table public.vol_events add column if not exists ask_affiliation boolean not null default false;
alter table public.vol_event_responses add column if not exists affiliation text;
alter table public.vol_event_responses add column if not exists organization text;

-- State of the Star is the invitation that goes to members and sponsors.
update public.vol_events set ask_affiliation = true where slug = 'state-of-the-star-2026';
