-- PayPal's own record of every payment (pulled by the sync-paypal-transactions function).
-- Used to fill in the exact fee/net on the Treasurer ledger and to spot payments the Portal does not know about.
create table if not exists public.paypal_transactions (
  transaction_id text primary key,
  occurred_at timestamptz not null,
  paid_on date not null,
  gross numeric not null,
  fee numeric not null default 0,
  net numeric not null,
  currency text not null default 'USD',
  status text,
  event_code text,
  payer_name text,
  payer_email text,
  subject text,
  note text,
  items text,
  invoice_id text,
  synced_at timestamptz not null default now()
);
create index if not exists paypal_transactions_paid_on on public.paypal_transactions (paid_on);
alter table public.paypal_transactions enable row level security; -- service role only
