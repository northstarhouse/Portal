-- Sponsors > Auction Items: the in-kind items donated for auctions (what it is, who gave it, its value, which event,
-- where it stands, and what it sold for). Optional link to a sponsor record.
-- Apply one statement at a time.

create table if not exists public.auction_items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  description text,
  donor text,
  sponsor_id bigint,
  donor_contact text,
  est_value numeric,
  event text,
  status text not null default 'Pledged',   -- Pledged | Received | Sold | Unsold | Returned
  received_date date,
  sold_amount numeric,
  winner text,
  acknowledged boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.auction_items enable row level security;

create policy "portal session all auction_items" on public.auction_items for all to anon using (public.has_valid_app_session()) with check (public.has_valid_app_session());

grant select, insert, update, delete on public.auction_items to anon;

CREATE OR REPLACE FUNCTION public.auction_items_stamp()
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

drop trigger if exists auction_items_stamp on public.auction_items;

create trigger auction_items_stamp before insert or update on public.auction_items for each row execute function public.auction_items_stamp();
