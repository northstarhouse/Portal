-- Staff onboarding packet: sent from Portal > Human Resources (Haley and Wyn only), filled in on the Volunteer Hub,
-- reviewed and printed back on the HR page. Safe to re-run.
create table if not exists public.onboarding_packets (
  id uuid primary key default gen_random_uuid(),
  person_name text not null,
  person_email text not null,
  status text not null default 'sent' check (status in ('sent', 'submitted')),
  data jsonb not null default '{}'::jsonb,
  hr_received jsonb not null default '{}'::jsonb,
  sent_by text,
  sent_at timestamptz not null default now(),
  submitted_at timestamptz
);
alter table public.onboarding_packets enable row level security;

drop policy if exists hr_all on public.onboarding_packets;
create policy hr_all on public.onboarding_packets for all to anon, authenticated
  using (public.app_session_name() in ('Haley Wright', 'Wyn Spiller'))
  with check (public.app_session_name() in ('Haley Wright', 'Wyn Spiller'));

-- The person it was sent to can read and fill in their own packet until they submit it.
drop policy if exists owner_read on public.onboarding_packets;
create policy owner_read on public.onboarding_packets for select to authenticated
  using (lower(person_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists owner_update on public.onboarding_packets;
create policy owner_update on public.onboarding_packets for update to authenticated
  using (lower(person_email) = lower(coalesce(auth.jwt() ->> 'email', '')) and status = 'sent')
  with check (lower(person_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Email Haley and Wyn the moment a packet is submitted.
create or replace function public.trg_onboarding_submitted()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  recips text[];
  v_link text := 'https://northstarhouse.github.io/Portal/#human-resources';
  v_name text := replace(replace(replace(new.person_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
begin
  if not (new.status = 'submitted' and old.status is distinct from 'submitted') then return new; end if;
  select array_agg(distinct lower(trim("Email"))) into recips from public."2026 Volunteers"
   where "First Name" = 'Haley' and "Last Name" = 'Wright'
     and nullif(trim("Email"), '') is not null;
  if recips is null then return new; end if;
  perform net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := jsonb_build_object('to', recips,
      'subject', 'Please sign: ' || new.person_name || ' completed their onboarding packet',
      'body', new.person_name || E' submitted their onboarding packet and it is ready for your supervisor signature.\n\nReview and sign it: ' || v_link,
      'html', '<div style="font-family:Georgia,serif;background:#f6f1e7;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6dfd3;border-top:4px solid #886c44;border-radius:10px;padding:28px"><div style="font-size:12px;letter-spacing:.12em;color:#886c44;font-weight:700">NORTH STAR HOUSE</div><h2 style="margin:8px 0 14px;font-size:22px;color:#2c2418">Onboarding Packet Ready to Sign</h2><p style="font-family:system-ui,sans-serif;color:#3a3226;line-height:1.5"><b>' || v_name || '</b> completed their onboarding packet. Please review it and add your supervisor signature.</p><p style="margin:20px 0 0"><a href="' || v_link || '" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;padding:11px 22px;border-radius:8px">Review and Sign</a></p></div></div>'),
    timeout_milliseconds := 20000);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists onboarding_submitted_email on public.onboarding_packets;
create trigger onboarding_submitted_email after update on public.onboarding_packets
  for each row execute function public.trg_onboarding_submitted();
