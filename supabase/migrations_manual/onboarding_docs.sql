-- Filled-in official PDFs (I-9, W-4, DE 4, Wage Notice, physician and chiropractor designations) for a staff onboarding packet.
-- Haley and Wyn can read them from Portal > Human Resources. The person the packet was sent to can read and save their own
-- copies until they submit the packet. They hold Social Security numbers, so nobody else can read this table. Safe to re-run.
create table if not exists public.onboarding_docs (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.onboarding_packets(id) on delete cascade,
  doc_key text not null,
  pdf_base64 text not null,
  saved_at timestamptz not null default now(),
  unique (packet_id, doc_key)
);
alter table public.onboarding_docs enable row level security;

drop policy if exists hr_all on public.onboarding_docs;
create policy hr_all on public.onboarding_docs for all to anon, authenticated
  using (public.app_session_name() in ('Haley Wright', 'Wyn Spiller'))
  with check (public.app_session_name() in ('Haley Wright', 'Wyn Spiller'));

drop policy if exists owner_read on public.onboarding_docs;
create policy owner_read on public.onboarding_docs for select to authenticated
  using (exists (select 1 from public.onboarding_packets p where p.id = packet_id
    and lower(p.person_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
drop policy if exists owner_insert on public.onboarding_docs;
create policy owner_insert on public.onboarding_docs for insert to authenticated
  with check (exists (select 1 from public.onboarding_packets p where p.id = packet_id and p.status = 'sent'
    and lower(p.person_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
drop policy if exists owner_update on public.onboarding_docs;
create policy owner_update on public.onboarding_docs for update to authenticated
  using (exists (select 1 from public.onboarding_packets p where p.id = packet_id and p.status = 'sent'
    and lower(p.person_email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  with check (exists (select 1 from public.onboarding_packets p where p.id = packet_id and p.status = 'sent'
    and lower(p.person_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
