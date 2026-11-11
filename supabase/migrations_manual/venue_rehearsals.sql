-- Automated wedding rehearsal offer.
-- Three calendar months before a confirmed wedding, the rehearsal-offers function checks whether the day before is free
-- (bookings, confirmed rehearsals, the venue Google Calendar: weddings, soft holds, closures, other events; public website
-- events). If it is, and a Rehearsal price is set in Policies & Resources, the couple is emailed an offer and their client
-- page shows "Add Rehearsal to My Wedding". Confirming rechecks availability, then claims the date here. The unique index
-- below is the double-booking safeguard: only one confirmed rehearsal can exist per date, so two couples can never both
-- get the same day even if they confirm at the same moment.
-- Apply one statement at a time.

create table if not exists public.venue_rehearsals (
  id uuid primary key default gen_random_uuid(),
  inquiry_id bigint not null references public.venue_inquiries(id) on delete cascade,
  wedding_date date not null,
  rehearsal_date date not null,
  status text not null default 'offered',  -- offered | confirmed | unavailable (checked, date was not free) | cancelled
  reason text,                              -- why it was not offered / not available
  price_cents integer,
  duration text,
  terms text,
  offered_at timestamptz,
  offer_sent_to text[],
  confirmed_at timestamptz,
  charge_ref text,                          -- the payment row or extra charge added for it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists venue_rehearsals_one_per_wedding on public.venue_rehearsals (inquiry_id);

create unique index if not exists venue_rehearsals_one_confirmed_per_date on public.venue_rehearsals (rehearsal_date) where status = 'confirmed';

alter table public.venue_rehearsals enable row level security;

create policy "portal session read venue_rehearsals" on public.venue_rehearsals for select to anon using (public.has_valid_app_session());

grant select on public.venue_rehearsals to anon;

select cron.schedule('rehearsal-offers-daily', '0 16 * * *', $cron$
  select net.http_post(
    url := 'https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/rehearsal-offers',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', 'Authorization', 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do'),
    body := '{}'::jsonb
  );
$cron$);
