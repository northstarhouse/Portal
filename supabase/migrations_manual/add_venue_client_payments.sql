-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Backs the public client page (#pay): clients enter their venue code (event
-- date), pay through PayPal, and upload insurance. Every PayPal capture is
-- recorded against the booking (venue_inquiries.id) that the code resolved to.

create table if not exists public.venue_payments (
  id uuid primary key default gen_random_uuid(),
  inquiry_id bigint not null references public.venue_inquiries(id),
  venue_code text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  paypal_order_id text not null,
  paypal_capture_id text not null unique,
  payer_name text,
  payer_email text,
  created_at timestamptz not null default now()
);
create index if not exists venue_payments_inquiry_idx on public.venue_payments(inquiry_id);
alter table public.venue_payments enable row level security;
revoke all on public.venue_payments from anon, authenticated;

-- Client-uploaded insurance goes to Google Drive (Admin / Venue Insurance);
-- this keeps the link to the latest upload.
alter table public.venue_inquiries add column if not exists insurance_drive_url text;

-- Wedding brick engraving chosen on the client page (3 lines, 20 characters max each).
alter table public.venue_inquiries add column if not exists brick_lines jsonb;
alter table public.venue_inquiries add column if not exists brick_submitted_at timestamptz;
