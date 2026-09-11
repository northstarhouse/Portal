-- Run this once in the Supabase SQL editor.
--
-- "Needs Attention" on the Venue Rentals dashboard is being narrowed to
-- strictly paperwork/signatures/payments (not after-event follow-up, which
-- has its own checklist already) -- these three columns back that.
--
-- Safe to run multiple times.

alter table venue_wedding_tracking add column if not exists contract_signed boolean not null default false;
alter table venue_wedding_tracking add column if not exists deposit_paid boolean not null default false;
alter table venue_wedding_tracking add column if not exists final_payment_received boolean not null default false;
