-- Let delete_prebooking_submission remove unsent drafts. The agreement safeguard still blocks every other delete and any
-- change to an issued agreement; only the delete function sets the one-transaction flag nsh.delete_unsent_drafts, and it
-- only runs when nothing for that submission was ever issued.
create or replace function public.venue_agreement_immutable()
returns trigger
language plpgsql
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
begin
 if tg_op='DELETE' and current_setting('nsh.delete_unsent_drafts', true)='on' then
  -- Separate IFs: plpgsql can't read old.status on tables that don't have it (history rows).
  if tg_table_name<>'venue_agreement_versions' then
   return old;
  end if;
  if (to_jsonb(old)->>'status') in ('draft','void') and (to_jsonb(old)->>'issued_at') is null then
   return old;
  end if;
 end if;
 if tg_op='DELETE' or tg_table_name='venue_agreement_events' then raise exception 'Agreement history is retained. Withdraw a request or create a revised version.'; end if;
 if tg_table_name='venue_agreement_versions' and old.status<>'draft' then
  if (to_jsonb(new)-array['status','updated_at','completed_at']) is distinct from (to_jsonb(old)-array['status','updated_at','completed_at']) or new.status='draft' then raise exception 'Issued agreement content is immutable.'; end if;
 end if;
 if tg_table_name='venue_agreement_signers' and old.status='signed' then
  if (to_jsonb(new)-array['token_hash','viewed_at']) is distinct from (to_jsonb(old)-array['token_hash','viewed_at']) then raise exception 'Recorded signatures are immutable.'; end if;
 end if;
 return new;
end;
$function$;

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
  if exists (select 1 from venue_agreement_versions where response_id = p_id and (status not in ('draft','void') or issued_at is not null)) then
    raise exception 'This client already has an agreement that was sent, so the submission cannot be deleted.';
  end if;
  select coalesce(array_agg(id), '{}') into ids from venue_agreement_versions where response_id = p_id;
  if array_length(ids, 1) > 0 then
    perform set_config('nsh.delete_unsent_drafts', 'on', true);
    delete from venue_agreement_events where version_id = any(ids);
    delete from venue_agreement_signers where version_id = any(ids);
    delete from venue_agreement_versions where id = any(ids);
    perform set_config('nsh.delete_unsent_drafts', 'off', true);
  end if;
  update venue_inquiries set prebooking_form_response_id = null where prebooking_form_response_id = p_id;
  delete from nsh_form_responses where id = p_id;
end;
$$;

grant execute on function public.delete_prebooking_submission(uuid, text) to anon, authenticated;
