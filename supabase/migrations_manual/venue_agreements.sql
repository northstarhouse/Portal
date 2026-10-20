begin;
create table if not exists public.venue_agreement_versions (
 id uuid primary key default gen_random_uuid(), response_id uuid not null references public.nsh_form_responses(id),
 version integer not null, title text not null, body text not null, signers jsonb not null default '[]',
 change_summary text not null default '', based_on uuid references public.venue_agreement_versions(id),
 status text not null default 'draft' check(status in ('draft','pending','completed','declined','void','superseded','expired')),
 document_hash text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 issued_at timestamptz, expires_at timestamptz, completed_at timestamptz,
 unique(response_id,version)
);
create unique index if not exists venue_agreement_one_draft on public.venue_agreement_versions(response_id) where status='draft';
create table if not exists public.venue_agreement_signers (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.venue_agreement_versions(id),
 name text not null, email text not null, role text not null check(role in ('client','venue')),
 token_hash text unique, status text not null default 'pending' check(status in ('pending','signed','declined')),
 viewed_at timestamptz, signed_at timestamptz, signed_name text, consent text, evidence jsonb,
 unique(version_id,email)
);
create table if not exists public.venue_agreement_events (
 id bigint generated always as identity primary key, version_id uuid not null references public.venue_agreement_versions(id),
 action text not null, actor text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.venue_agreement_codes (
 signer_id uuid primary key references public.venue_agreement_signers(id), code_hash text not null,
 expires_at timestamptz not null, attempts integer not null default 0, sent_at timestamptz not null default now()
);
alter table public.venue_agreement_versions enable row level security;
alter table public.venue_agreement_signers enable row level security;
alter table public.venue_agreement_events enable row level security;
alter table public.venue_agreement_codes enable row level security;
revoke all on public.venue_agreement_versions,public.venue_agreement_signers,public.venue_agreement_events,public.venue_agreement_codes from anon,authenticated;
grant all on public.venue_agreement_versions,public.venue_agreement_signers,public.venue_agreement_events,public.venue_agreement_codes to service_role;
grant usage,select on sequence public.venue_agreement_events_id_seq to service_role;

create or replace function public.venue_agreement_immutable() returns trigger
language plpgsql set search_path=public,extensions,pg_temp as $$
begin
 if tg_op='DELETE' or tg_table_name='venue_agreement_events' then raise exception 'Agreement history is retained. Withdraw a request or create a revised version.'; end if;
 if tg_table_name='venue_agreement_versions' and old.status<>'draft' then
  if (to_jsonb(new)-array['status','updated_at','completed_at']) is distinct from (to_jsonb(old)-array['status','updated_at','completed_at']) or new.status='draft' then raise exception 'Issued agreement content is immutable.'; end if;
 end if;
 if tg_table_name='venue_agreement_signers' and old.status='signed' then
  if (to_jsonb(new)-array['token_hash','viewed_at']) is distinct from (to_jsonb(old)-array['token_hash','viewed_at']) then raise exception 'Recorded signatures are immutable.'; end if;
 end if;
 return new;
end;
$$;
drop trigger if exists venue_agreement_versions_immutable on public.venue_agreement_versions;
create trigger venue_agreement_versions_immutable before update or delete on public.venue_agreement_versions for each row execute function public.venue_agreement_immutable();
drop trigger if exists venue_agreement_signers_immutable on public.venue_agreement_signers;
create trigger venue_agreement_signers_immutable before update or delete on public.venue_agreement_signers for each row execute function public.venue_agreement_immutable();
drop trigger if exists venue_agreement_events_immutable on public.venue_agreement_events;
create trigger venue_agreement_events_immutable before update or delete on public.venue_agreement_events for each row execute function public.venue_agreement_immutable();

-- These functions are service-role only. The edge function verifies staff
-- sessions or a recipient's hashed link before invoking them.
create or replace function public.venue_agreement_record(p_id uuid) returns jsonb
language sql security definer set search_path=public,extensions,pg_temp as $$
 select to_jsonb(v) || jsonb_build_object(
  'recipients',coalesce((select jsonb_agg(to_jsonb(s)-'token_hash' order by s.role,s.name) from venue_agreement_signers s where s.version_id=v.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from venue_agreement_events e where e.version_id=v.id),'[]'::jsonb))
 from venue_agreement_versions v where v.id=p_id;
$$;

create or replace function public.venue_agreement_action(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v venue_agreement_versions; s venue_agreement_signers; c venue_agreement_codes; r nsh_form_responses;
 rid uuid; vid uuid; spec jsonb; item jsonb; num integer; actor text:=coalesce(nullif(p_data->>'actor',''),'Venue staff');
 hashtext text; result jsonb; oldid uuid;
begin
 if p_action='expire' then
  for v in update venue_agreement_versions set status='expired',updated_at=now() where status='pending' and expires_at<=now() returning * loop
   insert into venue_agreement_events(version_id,action,actor) values(v.id,'expired','System');
  end loop;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(venue_agreement_record(id) order by version desc) from venue_agreement_versions where response_id=(p_data->>'response_id')::uuid),'[]'::jsonb);
 end if;
 if p_action in ('resolve','view','code','sign','decline') then
  select * into s from venue_agreement_signers where token_hash=p_data->>'token_hash';
  if not found then raise exception 'This signing link is invalid or has been replaced.'; end if;
  select response_id into rid from venue_agreement_versions where id=s.version_id;
  perform 1 from nsh_form_responses where id=rid for update;
  select * into v from venue_agreement_versions where id=s.version_id for update;
  select * into s from venue_agreement_signers where id=s.id for update;
  if s.token_hash is distinct from p_data->>'token_hash' then raise exception 'This link has been replaced.'; end if;
  if v.status='pending' and v.expires_at<=now() then
   update venue_agreement_versions set status='expired',updated_at=now() where id=v.id returning * into v;
   insert into venue_agreement_events(version_id,action,actor) values(v.id,'expired','System');
  end if;
  if p_action='resolve' then return jsonb_build_object('signer',to_jsonb(s)-'token_hash','version',venue_agreement_record(v.id)); end if;
  if p_action='view' then
   if s.viewed_at is null then
    update venue_agreement_signers set viewed_at=now() where id=s.id;
    insert into venue_agreement_events(version_id,action,actor) values(v.id,'viewed',s.name);
   end if;
   return jsonb_build_object('signer',to_jsonb(s)-'token_hash','version',venue_agreement_record(v.id),
    'can_sign',v.status='pending' and s.status='pending' and (s.role='client' or not exists(select 1 from venue_agreement_signers where version_id=v.id and role='client' and status<>'signed')));
  end if;
  if v.status<>'pending' then raise exception 'This version is %. It cannot accept signatures.',v.status; end if;
  if s.status<>'pending' then raise exception 'Your response has already been recorded.'; end if;
  if s.role='venue' and exists(select 1 from venue_agreement_signers where version_id=v.id and role='client' and status<>'signed') then raise exception 'All clients must sign before the venue countersigns.'; end if;
  if p_action='code' then
   select * into c from venue_agreement_codes where signer_id=s.id for update;
   if found and c.sent_at>now()-interval '60 seconds' then raise exception 'Please wait one minute before requesting another code.'; end if;
   insert into venue_agreement_codes(signer_id,code_hash,expires_at) values(s.id,p_data->>'code_hash',now()+interval '10 minutes')
    on conflict(signer_id) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,sent_at=now();
   insert into venue_agreement_events(version_id,action,actor) values(v.id,'verification_code_requested',s.name);
   return jsonb_build_object('email',s.email,'name',s.name,'title',v.title);
  end if;
  select * into c from venue_agreement_codes where signer_id=s.id for update;
  if not found or c.expires_at<=now() or c.attempts>=5 then return jsonb_build_object('error','Request a new verification code.'); end if;
  if c.code_hash is distinct from p_data->>'code_hash' then
   update venue_agreement_codes set attempts=attempts+1 where signer_id=s.id;
   return jsonb_build_object('error','Incorrect verification code.');
  end if;
  if p_action='decline' then
   if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Please provide a reason for declining.'; end if;
   update venue_agreement_signers set status='declined' where id=s.id;
   update venue_agreement_versions set status='declined',updated_at=now() where id=v.id;
   insert into venue_agreement_events(version_id,action,actor,detail) values(v.id,'declined',s.name,jsonb_build_object('reason',left(p_data->>'reason',2000)));
  else
   if p_data->>'document_hash' is distinct from v.document_hash then raise exception 'Document version changed. Reload and review it again.'; end if;
   if p_data->'consent' is distinct from 'true'::jsonb then raise exception 'Electronic signing consent is required.'; end if;
   if lower(regexp_replace(trim(p_data->>'signed_name'),'\s+',' ','g')) is distinct from lower(regexp_replace(trim(s.name),'\s+',' ','g')) then raise exception 'Type your full name exactly as shown.'; end if;
   update venue_agreement_signers set status='signed',signed_at=now(),signed_name=trim(p_data->>'signed_name'),
    consent='I have read this agreement and agree to sign it electronically. My typed name is my electronic signature for this exact document version.',
    evidence=jsonb_build_object('document_hash',v.document_hash,'email_verified_at',now(),'ip',p_data->>'ip','user_agent',left(p_data->>'user_agent',1000),'consent_version','2026-10-19') where id=s.id;
   insert into venue_agreement_events(version_id,action,actor,detail) values(v.id,case when s.role='venue' then 'countersigned' else 'signed' end,s.name,jsonb_build_object('signer_id',s.id,'document_hash',v.document_hash));
   if not exists(select 1 from venue_agreement_signers where version_id=v.id and status<>'signed') then
    update venue_agreement_versions set status='superseded',updated_at=now() where response_id=rid and status='completed';
    update venue_agreement_versions set status='completed',completed_at=now(),updated_at=now() where id=v.id;
    insert into venue_agreement_events(version_id,action,actor) values(v.id,'completed','System');
   end if;
  end if;
  delete from venue_agreement_codes where signer_id=s.id;
  return venue_agreement_record(v.id);
 end if;
 if p_action='draft' then
  rid:=(p_data->>'response_id')::uuid;
  select * into r from nsh_form_responses where id=rid for update;
  if not found or r.form_id not in ('a3a383f7-e1db-4344-9dec-ea879ad3406d'::uuid,'668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'::uuid) then raise exception 'Venue client not found.'; end if;
  if exists(select 1 from venue_agreement_versions where response_id=rid and status='draft') then raise exception 'Open the existing draft first.'; end if;
  select * into v from venue_agreement_versions where response_id=rid order by version desc limit 1;
  num:=coalesce(v.version,0)+1;oldid:=v.id;
  insert into venue_agreement_versions(response_id,version,title,body,signers,based_on,change_summary)
   values(rid,num,left(coalesce(p_data->>'title',v.title,'Venue Rental Agreement'),200),coalesce(p_data->>'body',v.body,''),coalesce(p_data->'signers',v.signers,'[]'),oldid,left(coalesce(p_data->>'change_summary',''),4000)) returning * into v;
  insert into venue_agreement_events(version_id,action,actor) values(v.id,'draft_created',actor);
  return venue_agreement_record(v.id);
 end if;
 vid:=(p_data->>'version_id')::uuid;
 select response_id into rid from venue_agreement_versions where id=vid;
 perform 1 from nsh_form_responses where id=rid for update;
 select * into v from venue_agreement_versions where id=vid for update;
 if not found then raise exception 'Contract version not found.'; end if;
 if p_action='save' then
  if v.status<>'draft' then raise exception 'Issued agreements are locked. Create a revised draft.'; end if;
  if p_data->>'expected_updated_at' is distinct from to_jsonb(v)->>'updated_at' then raise exception 'Another change was saved. Reload before editing.'; end if;
  if length(coalesce(p_data->>'body',''))>100000 then raise exception 'Contract is too long.'; end if;
  update venue_agreement_versions set title=left(trim(p_data->>'title'),200),body=p_data->>'body',signers=p_data->'signers',change_summary=left(coalesce(p_data->>'change_summary',''),4000),updated_at=clock_timestamp() where id=vid returning * into v;
  insert into venue_agreement_events(version_id,action,actor) values(vid,'draft_saved',actor);
 elsif p_action='issue' then
  if v.status<>'draft' then raise exception 'Only a draft may be issued.'; end if;
  if p_data->>'expected_updated_at' is distinct from to_jsonb(v)->>'updated_at' then raise exception 'Draft changed. Reload and review before issuing.'; end if;
  if length(trim(v.body))<100 or length(trim(v.title))<3 then raise exception 'Complete and review the contract text first.'; end if;
  if v.version>1 and length(trim(v.change_summary))<3 then raise exception 'Describe the changes before issuing a revised agreement.'; end if;
  if v.body ~ '\{\{[^}]+\}\}|\[TO COMPLETE\]' then raise exception 'Fill in every placeholder before issuing.'; end if;
  spec:=v.signers;
  if jsonb_typeof(spec)<>'array' or jsonb_array_length(spec)<2 or jsonb_array_length(spec)>6 then raise exception 'Choose 1–5 client signers and a venue countersigner.'; end if;
  if not exists(select 1 from jsonb_array_elements(spec) x where x->>'role'='client') or not exists(select 1 from jsonb_array_elements(spec) x where x->>'role'='venue') then raise exception 'A client and venue countersigner are required.'; end if;
  if (select count(*) from jsonb_array_elements(spec) x where x->>'role'='venue')<>1 then raise exception 'Choose exactly one venue countersigner.'; end if;
  if (select count(distinct lower(x->>'email')) from jsonb_array_elements(spec) x)<>jsonb_array_length(spec) then raise exception 'Every signer needs a separate email address.'; end if;
  if exists(select 1 from jsonb_array_elements(spec) x where coalesce(x->>'role','') not in ('client','venue') or length(trim(coalesce(x->>'name','')))<2 or coalesce(x->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Check all signer names, roles and email addresses.'; end if;
  if jsonb_array_length(p_data->'tokens')<>jsonb_array_length(spec) then raise exception 'Signing links could not be prepared.'; end if;
  hashtext:=encode(digest(convert_to(jsonb_build_object('title',v.title,'body',v.body,'signers',spec,'version',v.version,'change_summary',v.change_summary)::text,'UTF8'),'sha256'),'hex');
  update venue_agreement_versions set status='superseded',updated_at=now() where response_id=rid and status='pending';
  update venue_agreement_versions set status='pending',document_hash=hashtext,issued_at=now(),expires_at=now()+make_interval(days=>greatest(1,least(90,coalesce((p_data->>'expiry_days')::int,30)))),updated_at=now() where id=vid returning * into v;
  num:=0;
  for item in select * from jsonb_array_elements(spec) loop
   insert into venue_agreement_signers(version_id,name,email,role,token_hash) values(vid,trim(item->>'name'),lower(trim(item->>'email')),item->>'role',p_data->'tokens'->num->>'hash');num:=num+1;
  end loop;
  insert into venue_agreement_events(version_id,action,actor,detail) values(vid,'issued',actor,jsonb_build_object('document_hash',hashtext,'change_summary',v.change_summary));
 elsif p_action='link' then
  if v.status not in ('pending','completed','superseded') or (v.status='pending' and v.expires_at<=now()) then raise exception 'This agreement is no longer open for signing. Create a new version.'; end if;
  select * into s from venue_agreement_signers where id=(p_data->>'signer_id')::uuid and version_id=vid for update;
  if not found or s.status='declined' then raise exception 'Signer not available.'; end if;
  update venue_agreement_signers set token_hash=p_data->>'hash' where id=s.id;
  delete from venue_agreement_codes where signer_id=s.id;
  insert into venue_agreement_events(version_id,action,actor,detail) values(vid,'signing_link_reissued',actor,jsonb_build_object('signer_id',s.id));
 elsif p_action='revoke_link' then
  update venue_agreement_signers set token_hash=null where id=(p_data->>'signer_id')::uuid and version_id=vid returning * into s;
  if not found then raise exception 'Signer not found.'; end if;
  delete from venue_agreement_codes where signer_id=s.id;
  insert into venue_agreement_events(version_id,action,actor,detail) values(vid,'link_revoked',actor,jsonb_build_object('signer_id',s.id));
 elsif p_action='void' then
  if v.status not in ('draft','pending','expired','declined') then raise exception 'Completed agreements are retained. Create a revised draft or an amendment instead.'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Enter a reason for withdrawing this version.'; end if;
  update venue_agreement_versions set status='void',updated_at=now() where id=vid;
  insert into venue_agreement_events(version_id,action,actor,detail) values(vid,'voided',actor,jsonb_build_object('reason',left(p_data->>'reason',2000)));
 elsif p_action='delivery' then
  insert into venue_agreement_events(version_id,action,actor,detail) values(vid,'email_delivery',actor,p_data->'detail');
 else raise exception 'Unsupported agreement action.';
 end if;
 return venue_agreement_record(vid);
end;
$$;
revoke all on function public.venue_agreement_record(uuid),public.venue_agreement_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.venue_agreement_record(uuid),public.venue_agreement_action(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
