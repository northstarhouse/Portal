-- Make phone number required on the general inquiry forms (and the tour
-- request flow, handled in site code separately), per staff request.
update nsh_forms
set fields = (
  select jsonb_agg(
    case when (elem->>'label') ilike '%phone%' then elem || '{"required": true}'::jsonb else elem end
  )
  from jsonb_array_elements(fields) as elem
)
where id in (
  '1eea2137-f94d-414b-a977-4ed622214580', -- Wedding Inquiry
  'a87b86b0-94cd-4d28-b57e-00b79b5f1fee', -- Event Inquiry Form
  '5b886667-5230-4866-9874-7bc0dcdb3320', -- Private Event Inquiry
  'cd8f1e9f-06c5-4369-8b66-3498aff31465', -- Public Event Inquiry
  '952bc156-e89d-4790-814d-d2c2e9738a8b', -- Memorial Inquiry
  'e8cc69a1-1693-4fb4-8518-b8bb486dd055'  -- Non-Profit Event Inquiry
);

select id, title, jsonb_path_query_array(fields, '$[*] ? (@.label like_regex "phone" flag "i")') as phone_fields
from nsh_forms
where id in (
  '1eea2137-f94d-414b-a977-4ed622214580', 'a87b86b0-94cd-4d28-b57e-00b79b5f1fee',
  '5b886667-5230-4866-9874-7bc0dcdb3320', 'cd8f1e9f-06c5-4369-8b66-3498aff31465',
  '952bc156-e89d-4790-814d-d2c2e9738a8b', 'e8cc69a1-1693-4fb4-8518-b8bb486dd055'
);
