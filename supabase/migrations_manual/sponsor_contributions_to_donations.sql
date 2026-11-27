-- One-time fill: every 2026 contribution listed under a sponsor ("Sponsor In-Kind" rows) becomes its own row in Donations, as a
-- Business Sponsorship, one donation per contribution line. Cash lines carry their amount; discounts and in-kind work carry $0
-- with the value in the in-kind fields, so they are listed without being counted as cash. Each donation remembers which
-- contribution it came from (donations.sponsor_inkind_id) so nothing is counted twice: Finance leaves out sponsor cash that
-- already has a donation. Old entries are not queued for thank-you letters. Safe to re-run: a contribution already linked is skipped.
alter table public.donations add column if not exists sponsor_inkind_id bigint;

-- the sponsor sync should not fill a sponsor's donation text with "$0" for a non-cash line
create or replace function public.sync_sponsorship_donation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_email text; v_biz text; v_contact text; v_sid bigint; v_norm text; v_amt text; v_date text;
begin
  if new.type is distinct from 'Sponsorship' then return new; end if;
  select formal_name, lower(nullif(btrim(email), '')) into v_name, v_email from donors where id = new.donor_id;
  if v_name is null then return new; end if;
  if position('/' in v_name) > 0 then v_contact := btrim(split_part(v_name, '/', 1)); v_biz := btrim(substr(v_name, position('/' in v_name) + 1));
  else v_contact := ''; v_biz := btrim(v_name); end if;
  v_norm := regexp_replace(lower(v_biz), '[^a-z0-9]', '', 'g');
  v_amt := case when coalesce(new.amount, 0) > 0 then '$' || regexp_replace(new.amount::text, '\.00$', '') else '' end;
  v_date := to_char(new.date, 'FMMM/FMDD/YYYY');
  v_sid := new.sponsor_id;
  if v_sid is null or not exists (select 1 from "Sponsors" where id = v_sid) then
    v_sid := null;
    select id into v_sid from "Sponsors" where regexp_replace(lower("Business Name"), '[^a-z0-9]', '', 'g') = v_norm order by id limit 1;
    if v_sid is null and v_email is not null then select id into v_sid from "Sponsors" where lower(btrim("Email Address")) = v_email order by id limit 1; end if;
  end if;
  if v_sid is null then
    insert into "Sponsors" ("Business Name", "Main Contact", "Donation", "Fair Market Value", "Area Supported", "Email Address", "Date Recieved", "Acknowledged", sponsor_status)
    values (v_biz, v_contact, v_amt, v_amt, 'General', coalesce(v_email, ''), v_date, false, 'current') returning id into v_sid;
  else
    update "Sponsors" set sponsor_status = 'current',
      "Donation" = case when coalesce(btrim("Donation"), '') = '' then v_amt else "Donation" end,
      "Fair Market Value" = case when coalesce(btrim("Fair Market Value"), '') = '' then v_amt else "Fair Market Value" end,
      "Date Recieved" = case when coalesce(btrim("Date Recieved"), '') = '' then v_date else "Date Recieved" end
    where id = v_sid;
  end if;
  if new.sponsor_id is distinct from v_sid or new.acknowledgment_type is null then update donations set sponsor_id = v_sid, acknowledgment_type = coalesce(acknowledgment_type, 'Sponsorship') where id = new.id; end if;
  return new;
exception when others then
  raise warning 'sync_sponsorship_donation failed for donations.id=%: %', new.id, sqlerrm;
  return new;
end $$;

do $$
declare k record; v_donor uuid; v_cash boolean; v_note text; v_pay text; v_existing uuid;
begin
  for k in
    select ik.*, s."Business Name" biz, lower(nullif(btrim(s."Email Address"), '')) em
    from "Sponsor In-Kind" ik join "Sponsors" s on s.id = ik.sponsor_id
    where ik.date >= '2026-01-01' and ik.date < '2027-01-01'
      and not exists (select 1 from donations d where d.sponsor_inkind_id = ik.id)
    order by ik.date, ik.id
  loop
    v_cash := k.contribution_type = 'Monetary Value' or k.contribution_type is null;
    -- a donation already entered for this very contribution (same sponsor, day and amount): link it, do not add another
    select d.id into v_existing from donations d where d.sponsor_id = k.sponsor_id and d.date = k.date and d.amount = coalesce(k.value, 0) and d.sponsor_inkind_id is null and d.type = 'Sponsorship' limit 1;
    if v_existing is not null then update donations set sponsor_inkind_id = k.id where id = v_existing; continue; end if;
    select id into v_donor from donors where lower(btrim(formal_name)) = lower(btrim(k.biz)) limit 1;
    if v_donor is null and k.em is not null then select id into v_donor from donors where lower(btrim(email)) = k.em limit 1; end if;
    if v_donor is null then insert into donors (formal_name, email) values (btrim(k.biz), k.em) returning id into v_donor; end if;
    v_pay := case when coalesce(k.description, '') ilike '%check%' then 'Check' when coalesce(k.description, '') ilike '%cash%' then 'Cash' else 'Other' end;
    v_note := nullif(btrim(coalesce(case when v_cash then '' else coalesce(k.contribution_type, '') || ': ' end, '') || coalesce(k.description, '')), '');
    insert into donations (donor_id, amount, date, type, payment_type, donation_notes, acknowledged, acknowledgment_status, acknowledgment_type, sponsor_id, sponsor_inkind_id, in_kind_description, in_kind_value)
    values (v_donor, case when v_cash then coalesce(k.value, 0) else 0 end, k.date, 'Sponsorship', v_pay, v_note, true, 'not_required', 'Sponsorship', k.sponsor_id, k.id,
            case when v_cash then null else nullif(btrim(coalesce(k.description, '')), '') end, case when v_cash then null else k.value end);
  end loop;
end $$;
