-- A donation can be marked as a Sponsorship (donations.type = 'Sponsorship'). It stays in Donations, marked and filterable, and the
-- business is added to the Sponsors section by itself: matched to an existing sponsor by name (punctuation and spacing ignored) or
-- email, otherwise added as a new current sponsor. A donor written "Contact Name/Business Name" is split into contact and business.
-- The donation remembers which sponsor it went to (donations.sponsor_id). Un-marking a donation leaves the sponsor record alone.
-- Safe to re-run.
alter table public.donations add column if not exists sponsor_id bigint;

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
  v_amt := '$' || regexp_replace(new.amount::text, '\.00$', '');
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
drop trigger if exists trg_sync_sponsorship_donation on public.donations;
create trigger trg_sync_sponsorship_donation after insert or update of type, amount, donor_id on public.donations
  for each row execute function public.sync_sponsorship_donation();
