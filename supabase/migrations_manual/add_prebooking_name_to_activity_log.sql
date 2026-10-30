-- Run once in the Supabase SQL editor.
-- The Activity Log entry for a new pre-booking submission now says who submitted it, e.g.
--   "New Wedding Pre-Booking form submitted: Taylor Test + Jordan Test"
create or replace function log_form_submission_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_title text;
  who text := '';
begin
  select title into form_title from nsh_forms where id = new.form_id;
  if form_title is null then
    return new;
  end if;

  if new.form_id in ('a3a383f7-e1db-4344-9dec-ea879ad3406d'::uuid, '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'::uuid) then
    who := trim(coalesce(new.answers->>'7fnabd0i', new.answers->>'evp_name', ''))
      || case when coalesce(new.answers->>'7leui2ic', '') <> '' then ' + ' || (new.answers->>'7leui2ic') else '' end;
  end if;

  insert into activity_log (description, action, detail)
  values (
    'New ' || form_title || ' form submitted' || case when who <> '' then ': ' || who else '' end,
    'form_submission',
    jsonb_build_object('form_id', new.form_id, 'response_id', new.id, 'form_title', form_title)
  );
  return new;
end;
$$;
