-- Delete a pre-booking form submission from the Portal. Unsent contract drafts for it are removed too.
-- Requires the delete password (only its SHA-256 hash is stored here). Refuses when an agreement was ever issued,
-- so signed records are never lost.
drop function if exists public.delete_prebooking_submission(uuid);

create or replace function public.delete_prebooking_submission(p_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ids uuid[];
begin
  if not has_valid_app_session() then
    raise exception 'Please sign in to the Portal again.';
  end if;
  if encode(digest(coalesce(p_password, ''), 'sha256'), 'hex') <> '651e8dcd092789542c2042cab962b3db8d918456bdb6cbe928477745c7ae60c1' then
    raise exception 'Incorrect password.';
  end if;
  if exists (select 1 from venue_agreement_versions where response_id = p_id and (status <> 'draft' or issued_at is not null)) then
    raise exception 'This client already has an agreement that was sent, so the submission cannot be deleted.';
  end if;
  select coalesce(array_agg(id), '{}') into ids from venue_agreement_versions where response_id = p_id;
  if array_length(ids, 1) > 0 then
    update venue_agreement_versions set based_on = null where based_on = any(ids);
    delete from venue_agreement_events where version_id = any(ids);
    delete from venue_agreement_signers where version_id = any(ids);
    delete from venue_agreement_versions where id = any(ids);
  end if;
  update venue_inquiries set prebooking_form_response_id = null where prebooking_form_response_id = p_id;
  delete from nsh_form_responses where id = p_id;
end;
$$;

grant execute on function public.delete_prebooking_submission(uuid, text) to anon, authenticated;
