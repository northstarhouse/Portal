-- Sponsors > Auction Items also appears in the Events Committee planning page ("Sponsor Provided Items"), which the Volunteer Hub
-- reaches as a signed-in volunteer. Let volunteers tagged Events, Staff or Board read and edit it (the Portal keeps its own
-- session policy). Donor contact details stay off limits to everyone else.

create or replace function public.is_events_staff_user()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public."2026 Volunteers" v
    where lower(v."Email") = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (v."Team" ilike '%events%' or v."Team" ilike '%staff%' or v."Team" ilike '%board%')
  );
$function$;

grant execute on function public.is_events_staff_user() to authenticated;

drop policy if exists "events committee all auction_items" on public.auction_items;
create policy "events committee all auction_items" on public.auction_items for all to authenticated using (public.is_events_staff_user()) with check (public.is_events_staff_user());

grant select, insert, update, delete on public.auction_items to authenticated;
