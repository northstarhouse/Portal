-- Activity Log: a Newsletter Sign Up submission reads "Newsletter Sign Up Form Submitted: <who>" (the form only collects an email).
-- Replaces the form-submission logger; every other form is logged exactly as before. Safe to re-run.

CREATE OR REPLACE FUNCTION public.log_form_submission_to_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  form_title text;
  who text := '';
begin
  select title into form_title from nsh_forms where id = new.form_id;
  if form_title is null then
    return new;
  end if;

  -- Newsletter Sign Up: shown as 'Newsletter Sign Up Form Submitted: <who>' (the form only asks for an email, so that is who it shows unless a name was given)
  if new.form_id = 'ee7add8b-277c-4309-8c45-60b13b3befd3'::uuid then
    who := trim(coalesce(nullif(trim(coalesce(new.answers->>'name', new.answers->>'full_name', '')), ''), new.answers->>'email', ''));
    insert into activity_log (description, action, detail)
    values ('Newsletter Sign Up Form Submitted' || case when who <> '' then ': ' || who else '' end, 'form_submission', jsonb_build_object('form_id', new.form_id, 'response_id', new.id, 'form_title', form_title));
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
$function$
;
