-- Committee notes get their own field on an Events Committee event, apart from the description (the description is what
-- goes to the website). Finalizing an event from the Event Plan used to paste "Budget: ..." and "Committee decisions: ..."
-- into the description; this moves those into the new field and leaves the rest of the description in place.
-- Safe to run more than once.

alter table public.events_committee add column if not exists committee_notes text;

update public.events_committee
set committee_notes = nullif(trim(both E'\n ' from regexp_replace(description, '^Day [0-9]+ of [0-9]+ of [^\n]*(\n\n|$)', '')), ''),
    description     = nullif(trim(coalesce((regexp_match(description, '^(Day [0-9]+ of [0-9]+ of [^\n]*)'))[1], '')), '')
where committee_notes is null
  and description ~ '(^|\n\n)(Budget: |Committee decisions: )';
