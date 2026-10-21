-- The "Event Inquiry Form" was shared verbatim across 4 public pages
-- (Private Events, Public Events, Memorials, Non-Profit), all submitting to
-- the exact same nsh_forms row -- staff had no way to tell which page an
-- inquiry came in from just by its form title. Clone it into 4 distinct
-- forms (same fields, just a clear title per page); the generic "Events"
-- page keeps the original form id unchanged.
insert into nsh_forms (id, title, fields)
select gen_random_uuid(), v.title, f.fields
from nsh_forms f, (values
  ('Private Event Inquiry'),
  ('Public Event Inquiry'),
  ('Memorial Inquiry'),
  ('Non-Profit Event Inquiry')
) as v(title)
where f.id = 'a87b86b0-94cd-4d28-b57e-00b79b5f1fee';

select id, title from nsh_forms
where title in ('Private Event Inquiry', 'Public Event Inquiry', 'Memorial Inquiry', 'Non-Profit Event Inquiry');
