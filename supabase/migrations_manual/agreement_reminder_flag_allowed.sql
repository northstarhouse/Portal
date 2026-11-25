-- The signing-reminder flag is bookkeeping, not agreement content, so it may be saved on an issued agreement.
-- (Before this, saving it was refused, so the hourly job could not record a reminder as sent.) Safe to re-run.
CREATE OR REPLACE FUNCTION public.venue_agreement_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
  if (to_jsonb(new)-array['status','updated_at','completed_at','expiry_reminder_sent_at']) is distinct from (to_jsonb(old)-array['status','updated_at','completed_at','expiry_reminder_sent_at']) or new.status='draft' then raise exception 'Issued agreement content is immutable.'; end if;
 end if;
 if tg_table_name='venue_agreement_signers' and old.status='signed' then
  if (to_jsonb(new)-array['token_hash','viewed_at']) is distinct from (to_jsonb(old)-array['token_hash','viewed_at']) then raise exception 'Recorded signatures are immutable.'; end if;
 end if;
 return new;
end;
$function$
;
