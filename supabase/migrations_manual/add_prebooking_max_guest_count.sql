-- Adds a required "Maximum Guest Count" question to both pre-booking forms (Wedding and Events),
-- right after the Confirmed Event Date. Safe to re-run: a form that already has the question is left alone.
-- (The form builder has no number type, so it is a short text answer.)

update public.nsh_forms f
set fields = (
  select coalesce(jsonb_agg(x.item order by x.ord), '[]'::jsonb)
  from (
    select e.item, e.ord from jsonb_array_elements(f.fields) with ordinality as e(item, ord)
    union all
    select jsonb_build_object('id', 'max_guests', 'type', 'short_text', 'label', 'Maximum Guest Count (the most guests you expect at your event)', 'required', true),
           coalesce((select e2.ord from jsonb_array_elements(f.fields) with ordinality as e2(item, ord) where e2.item->>'type' = 'date' and e2.item->>'label' ilike 'Confirmed Event Date%' limit 1), jsonb_array_length(f.fields)) + 0.5
  ) x
)
where f.id in ('a3a383f7-e1db-4344-9dec-ea879ad3406d', '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8')
  and not exists (select 1 from jsonb_array_elements(f.fields) e where e->>'id' = 'max_guests');
