-- Venue Rentals > Tools > Policies & Resources: one place for venue pricing, templates, FAQs, Site Manager and Venue
-- Coordinator references, and venue information. Every change is written to venue_resource_history automatically,
-- with the signed-in Portal person (app_session_name()).
-- Seeded from what is published on the website (Nov 2026). Nothing here is invented: topics with no written policy yet
-- (soft holds, corporate pricing, ...) are left for the venue team to add.
-- Apply one statement at a time.

create table if not exists public.venue_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null,               -- pricing | template | faq | sm_ref | vc_ref | info
  category text,                    -- rental type, document type, FAQ category, section
  title text not null,
  body text,                        -- official answer / content / template text
  detail text,                      -- optional longer explanation
  data jsonb not null default '{}'::jsonb, -- pricing fields, template fields (version, url, format), related documents
  audience text not null default 'internal', -- client (safe to share) | internal
  status text not null default 'approved',   -- approved | draft | archived
  year int,                         -- rental year (pricing, templates when relevant)
  quick_ref boolean not null default false,  -- shown in Quick Reference
  needs_review boolean not null default false, -- templates flagged after a pricing/policy change
  sort_order int not null default 0,
  approved_at date,
  change_summary text,              -- the summary for the change being saved (copied into the history)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.venue_resource_history (
  id bigserial primary key,
  resource_id uuid,
  at timestamptz not null default now(),
  action text not null,             -- created | updated | deleted
  kind text,
  category text,
  title text,
  updated_by text,
  summary text,
  previous jsonb,
  next jsonb
);

-- Only one approved price schedule per rental type per year.
create unique index if not exists venue_resources_one_approved_price on public.venue_resources (category, year) where kind = 'pricing' and status = 'approved';

alter table public.venue_resources enable row level security;

alter table public.venue_resource_history enable row level security;

create policy "portal session all venue_resources" on public.venue_resources for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

create policy "portal session read venue_resource_history" on public.venue_resource_history for select to anon using (public.has_valid_app_session());

grant select, insert, update, delete on public.venue_resources to anon;

grant select on public.venue_resource_history to anon;

CREATE OR REPLACE FUNCTION public.venue_resources_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  new.updated_by := coalesce(public.app_session_name(), new.updated_by);
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.venue_resources_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record;
begin
  if TG_OP = 'DELETE' then r := old; else r := new; end if;
  insert into public.venue_resource_history (resource_id, action, kind, category, title, updated_by, summary, previous, next)
  values (r.id, case TG_OP when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    r.kind, r.category, r.title, coalesce(public.app_session_name(), r.updated_by),
    case when TG_OP = 'DELETE' then 'Deleted' else r.change_summary end,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) - 'change_summary' end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) - 'change_summary' end);
  return null;
end
$function$;

drop trigger if exists venue_resources_stamp on public.venue_resources;

create trigger venue_resources_stamp before insert or update on public.venue_resources for each row execute function public.venue_resources_stamp();

drop trigger if exists venue_resources_log on public.venue_resources;

create trigger venue_resources_log after insert or update or delete on public.venue_resources for each row execute function public.venue_resources_log();

-- ── Seed: pricing (2026, from the website) ───────────────────────────────────
insert into public.venue_resources (kind, category, title, year, audience, status, sort_order, change_summary, updated_by, data) values
('pricing', 'Wedding', 'Wedding rental', 2026, 'client', 'approved', 0, 'Added from the website', 'Setup', $j${
  "base_price": "$5,000",
  "retainer": "$800 non-refundable, due at signing; counts toward the rental",
  "included_hours": "10 consecutive hours (setup, event and clean-up); latest slot 1 PM to 11 PM",
  "extra_hour": "Additional hours arranged in advance for an extra fee",
  "fees": "$800 refundable security deposit, due 1 month before the wedding. Outdoor heaters $50 each (propane included).",
  "payment_schedule": "50% due 5 months before the wedding; remaining 50% due 3 months before",
  "amenities": "Exclusive use of the House and grounds; tables and chairs for up to 250 guests; personalized commemorative brick; catering kitchen",
  "conditions": "$1 million liability insurance naming North Star Historic Conservancy as additionally insured. Caterer approved before signing. Day-of coordinator required. Music ends by 10 PM.",
  "notes": "From the Weddings page (Nov 2026)."
}$j$::jsonb),
('pricing', 'Private Event', 'Private event rental', 2026, 'client', 'approved', 1, 'Added from the website', 'Setup', $j${
  "rates": [{"label": "Saturday", "price": "$1,200"}, {"label": "Sunday", "price": "$1,000"}, {"label": "Weekdays", "price": "$800"}],
  "included_hours": "6 hours on site, between 10 AM and 10 PM",
  "extra_hour": "$150 per hour",
  "booking_window": "8 months in advance",
  "notes": "From the Private Events page (Nov 2026)."
}$j$::jsonb),
('pricing', 'Nonprofit', 'Nonprofit rental', 2026, 'client', 'approved', 2, 'Added from the website', 'Setup', $j${
  "rates": [
    {"label": "Large private event (up to 200 guests, 4 hr), Sat/Sun", "price": "$800", "extra": "extra hour $150"},
    {"label": "Small private event (up to 50 guests, 4 hr), Sat/Sun", "price": "$600", "extra": "extra hour $150"},
    {"label": "Public event (permit capacity, 6 hr), Sat/Sun", "price": "$2,000", "extra": "extra hour $300"}
  ],
  "included_hours": "4 hours (6 hours for public events)",
  "booking_window": "6 months in advance",
  "notes": "From the Nonprofit page (Nov 2026)."
}$j$::jsonb),
('pricing', 'Memorial', 'Memorial / celebration of life', 2026, 'client', 'approved', 3, 'Added from the website', 'Setup', $j${
  "rates": [{"label": "Friday", "price": "$400"}, {"label": "Saturday", "price": "$800"}, {"label": "Sunday", "price": "$600"}],
  "included_hours": "4 hours",
  "booking_window": "3 months in advance (rolling window, open dates only)",
  "notes": "From the Memorials page (Nov 2026)."
}$j$::jsonb);

-- ── Seed: policies & FAQs (from the website) ─────────────────────────────────
insert into public.venue_resources (kind, category, title, body, audience, status, quick_ref, sort_order, change_summary, updated_by) values
('faq', 'Bookings and reservations', 'What payments are required to reserve the venue?', $t$To officially reserve a date, a non-refundable $800 retainer is due at the time of signing. The retainer counts toward the overall venue cost.$t$, 'client', 'approved', true, 0, 'Added from the website', 'Setup'),
('faq', 'Retainers and payments', 'When is the rental fee due?', $t$The rental fee is split into two installments: 50% is due 5 months before the wedding, and the remaining 50% is due 3 months before.$t$, 'client', 'approved', false, 1, 'Added from the website', 'Setup'),
('faq', 'Retainers and payments', 'Is there a security deposit?', $t$Yes. An $800 refundable security deposit is due 1 month before the event. It is returned after the event if no damages occur and policies are followed.$t$, 'client', 'approved', true, 2, 'Added from the website', 'Setup'),
('faq', 'Retainers and payments', 'Is liability insurance required?', $t$Yes. A $1 million liability insurance policy naming North Star Historic Conservancy as additionally insured is required. These policies are typically affordable and easy to obtain.$t$, 'client', 'approved', true, 3, 'Added from the website', 'Setup'),
('faq', 'Retainers and payments', 'Are there any hidden costs?', $t$No. All required costs are outlined in the rental agreement. Add-ons (such as additional hours) are available but not required.$t$, 'client', 'approved', false, 4, 'Added from the website', 'Setup'),
('faq', 'Rental access and hours', 'What are the rental hours for a wedding?', $t$A standard wedding rental includes 10 consecutive hours covering setup, the event and clean-up. Additional hours can be arranged in advance for an extra fee. The latest timeslot is 1 PM to 11 PM.$t$, 'client', 'approved', true, 5, 'Added from the website', 'Setup'),
('faq', 'Rental access and hours', 'Can clients set up before their rental time?', $t$Clients may begin setting up outside before their rental hours, but a site manager will not open the inside of the House until the contracted time begins.$t$, 'client', 'approved', false, 6, 'Added from the website', 'Setup'),
('faq', 'Rental access and hours', 'How late can an event run?', $t$Events end by 11 PM.$t$, 'client', 'approved', true, 7, 'Added (venue team)', 'Setup'),
('faq', 'Music and noise', 'How late can music go?', $t$Music (and the party) must end by 10:00 PM, in compliance with local noise ordinances.$t$, 'client', 'approved', true, 8, 'Added from the website', 'Setup'),
('faq', 'Music and noise', 'Is there a stage or sound system?', $t$There is no formal stage or sound system. Many couples use the Courtyard as a dance floor; it has market and twinkle lights and outlets on separate circuits. Performers bring their own PA and any staging.$t$, 'client', 'approved', false, 9, 'Added from the website', 'Setup'),
('faq', 'Vendors and catering', 'Can clients choose their own vendors?', $t$Yes. Clients may bring their own vendors for catering, rentals, bar service, florals and more. A recommended vendor list is available. The caterer must be approved before the contract is signed.$t$, 'client', 'approved', true, 10, 'Added from the website', 'Setup'),
('faq', 'Alcohol', 'Can clients bring their own alcohol?', $t$Yes. North Star House is a BYO alcohol venue with no corkage fee. Self-serve (for example beer and wine in coolers) is allowed. A caterer is required, but they do not need to serve the alcohol.$t$, 'client', 'approved', true, 11, 'Added from the website', 'Setup'),
('faq', 'Setup and breakdown', 'Are linens, dishes and glassware provided?', $t$No. Linens, cutlery, glassware and dishes come from the caterer or a rental company.$t$, 'client', 'approved', false, 12, 'Added from the website', 'Setup'),
('faq', 'Setup and breakdown', 'Are outdoor heaters available?', $t$Yes, 4 heaters at $50 each, propane included. They can be added last minute and deducted from the security deposit.$t$, 'client', 'approved', false, 13, 'Added from the website', 'Setup'),
('faq', 'Building and grounds access', 'What happens if the weather is bad?', $t$The House seats up to 76 guests indoors and the covered terraces give sheltered space outside. Tents are allowed for larger groups.$t$, 'client', 'approved', false, 14, 'Added from the website', 'Setup'),
('faq', 'Cleaning and damage', 'Who is responsible for clean-up?', $t$Clients and their vendors are responsible for all clean-up and removal of décor within the rental period. The venue does not provide clean-up staff.$t$, 'client', 'approved', true, 15, 'Added from the website', 'Setup'),
('faq', 'Site Manager requirements', 'What staffing does the venue provide?', $t$A venue coordinator supports the client with venue questions, logistics and tours before the event. On the day, the client must have a designated day-of coordinator as the main contact for vendors. North Star House provides a site manager during rental hours to oversee the property.$t$, 'client', 'approved', true, 16, 'Added from the website', 'Setup');

-- ── Seed: venue information & amenities (from the website) ────────────────────
insert into public.venue_resources (kind, category, title, body, audience, status, sort_order, change_summary, updated_by) values
('info', 'Location', 'Address', $t$12075 Auburn Road, Grass Valley, CA, a short drive from downtown Nevada City.$t$, 'client', 'approved', 0, 'Added from the website', 'Setup'),
('info', 'Capacities', 'Guest capacities', $t$Tables and chairs for up to 250 guests are included with a wedding rental. The House seats up to 76 guests indoors.$t$, 'client', 'approved', 1, 'Added from the website', 'Setup'),
('info', 'Rental spaces', 'Reception Hall & Dining Room', $t$Connected indoor spaces with original Arts & Crafts woodwork and large windows. Seats up to 76 guests.$t$, 'client', 'approved', 2, 'Added from the website', 'Setup'),
('info', 'Rental spaces', 'Courtyard', $t$Off the East Lawn and next to the catering kitchen. Popular for dancing, DJs and bands. Market and twinkle lights, outlets on separate circuits. Four outdoor heaters available ($50 each).$t$, 'client', 'approved', 3, 'Added from the website', 'Setup'),
('info', 'Rental spaces', 'East Lawn', $t$One of the largest outdoor spaces, used for receptions, dinners and community events. Room for tables, tents and décor for large guest counts; right beside the catering kitchen.$t$, 'client', 'approved', 4, 'Added from the website', 'Setup'),
('info', 'Rental spaces', 'Terrace', $t$Along the south side of the House; often used for cocktail hours, mingling and sunset views. Connects the House and the outdoor spaces.$t$, 'client', 'approved', 5, 'Added from the website', 'Setup'),
('info', 'Rental spaces', 'Heritage Garden', $t$A peaceful garden of native plants behind the House; often used for portraits and first-look photos.$t$, 'client', 'approved', 6, 'Added from the website', 'Setup'),
('info', 'Catering arrangements', 'Catering kitchen', $t$Near the Courtyard, just off the East Lawn, with prep counters and refrigeration. Clients choose their own caterer (approved before signing). BYO alcohol, no corkage fee.$t$, 'client', 'approved', 7, 'Added from the website', 'Setup');

-- ── Seed: Site Manager reference (from the Site Manager packet) ──────────────
insert into public.venue_resources (kind, category, title, body, audience, status, sort_order, change_summary, updated_by) values
('sm_ref', 'Arrival and property opening', 'Walk-through: open the property', $t$- Outdoor restrooms: breaker on, doors unlocked, lights on, paper products stocked, cans lined
- Kitchen: lights on, contact info posted on fridge, supply bin stocked, can liners available, pantry locked, counters clear, fridge on, restroom stocked
- Trash corral: plug in walkway lights, place trash and recycle bins out
- Dining Room: lights on, chairs off tables, table sleeves on, porch door locked
- Mudroom & Study: lights on, wastebasket lined, mirrors from foyer in place, clothing rack out
- Terrace & West Lawn: outside lights on, lawn cleared and tidy
- Living Room: lights on
- Library: lights on, chairs off table, doors unlocked
- Julia Morgan Room: lights on, doors unlocked, chairs off tables, coat rack from foyer, wastebasket lined, put away décor items (see SM Guidebook)
- Restrooms & Foyer: lights on, cans lined, paper products stocked
- Courtyard & East Lawn: twinkle, courtyard and lawn lights on
- Parking lot: flood lights on
- Garden: unlock, clear and clean$t$, 'internal', 'approved', 0, 'Added from the Site Manager packet', 'Setup'),
('sm_ref', 'Closing procedures', 'Before leaving', $t$- All rentals put away
- Trash and recycling handled properly
- No pets on site
- No evidence of smoking or fire
- Note anything needing attention (extra hours, maintenance needs, event mishaps)
- Record Time In, Time Out and Total Hours, plus the Guests' Actual Out Time (used for billing if different)
- Sign the sheet$t$, 'internal', 'approved', 1, 'Added from the Site Manager packet', 'Setup'),
('sm_ref', 'Incident reporting', 'Final paperwork', $t$After the event, the site manager's completed sheet is uploaded in the Portal (client → Site manager paperwork). It is saved to the client's Drive folder as "FINAL - Site Manager Paperwork" and emailed to media@ and Wyn. Until it is uploaded, the past event shows NEEDS ATTENTION.$t$, 'internal', 'approved', 2, 'Added (Portal process)', 'Setup');

-- ── Seed: Venue Coordinator reference (how the Portal handles each step) ──────
insert into public.venue_resources (kind, category, title, body, audience, status, sort_order, change_summary, updated_by) values
('vc_ref', 'New inquiry workflow', 'Inquiries', $t$Inquiries from the website land in Venue Rentals → Inquiries. Clients who have not booked or requested a tour within two days get an automatic branded follow-up email. Docent tour requests that are really about a wedding or event: use "Wedding/event? Send venue reply" on the request.$t$, 'internal', 'approved', 0, 'Added (Portal process)', 'Setup'),
('vc_ref', 'Tours and follow-ups', 'Tours', $t$Tours are booked from the website or with Tools → Add a tour to the calendar. Confirmation and reminder emails go out automatically. Record the outcome on the tour request (Contacted / Not interested).$t$, 'internal', 'approved', 1, 'Added (Portal process)', 'Setup'),
('vc_ref', 'Pre-booking form procedures', 'Pre-booking forms', $t$Tools → Send out a pre-booking form emails the form; Tools → Fill out a pre-booking form enters one for a client who skipped it. A submitted pre-booking form makes them a client.$t$, 'internal', 'approved', 2, 'Added (Portal process)', 'Setup'),
('vc_ref', 'Contract preparation', 'Contracts', $t$Prepare and send the agreement from the client's View details → Contract. The client signs first, then the venue countersigns. The payment schedule is created with the agreement.$t$, 'internal', 'approved', 3, 'Added (Portal process)', 'Setup'),
('vc_ref', 'Site Manager handoffs', 'Site managers', $t$Assign the site manager in the client's View details (or Assign Site Managers). Once the questionnaire is complete, print the Site Manager packet from the client.$t$, 'internal', 'approved', 4, 'Added (Portal process)', 'Setup'),
('vc_ref', 'Post-event closeout', 'After the event', $t$Record the guests' and site manager's out times (event-day times, for billing), upload the FINAL site manager paperwork, and settle the security deposit using the Security Deposit Accounting Form in the packet.$t$, 'internal', 'approved', 5, 'Added (Portal process)', 'Setup');

-- ── Seed: templates that already exist ───────────────────────────────────────
insert into public.venue_resources (kind, category, title, body, audience, status, sort_order, change_summary, updated_by, data) values
('template', 'Rental Agreements', 'Wedding contract template', $t$The wedding rental agreement is generated in the Portal from the client's details (client → View details → Contract).$t$, 'internal', 'approved', 0, 'Added (Portal process)', 'Setup', '{"version": "1", "format": "Portal"}'::jsonb),
('template', 'Event Management', 'Site Manager packet', $t$Printed from the client's View details once the questionnaire is complete: Event Information, Security Deposit Accounting Form, Walk-Through & Checklist.$t$, 'internal', 'approved', 1, 'Added (Portal process)', 'Setup', '{"version": "1", "format": "Portal"}'::jsonb),
('template', 'Client Communication', 'Docent tour request → venue tour reply', $t$Hi [First name],

Thank you for your interest in North Star House! The form you filled out is for our historic docent tours, which focus on the history and architecture of the house.

To see North Star House as a wedding venue, please book a free venue tour with our venue team instead. You'll see the spaces, talk through your plans, and we can check date availability for you. You can choose a time that works for you here:

https://www.northstarhouse.org/book-a-tour

We'd love to show you around!

Warmly,
The North Star House Venue Team$t$, 'client', 'approved', 2, 'Added (Portal reply)', 'Setup', '{"version": "1", "format": "Text"}'::jsonb);
