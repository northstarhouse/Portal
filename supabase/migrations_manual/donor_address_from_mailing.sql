-- One address per donor: the structured mailing address. donors.address is now only an automatic one-line copy of it
-- (kept so older tools and the donors app that still read it keep working). Nobody edits it by hand any more.
-- Only rewritten when a mailing field is set, so donors with only a legacy address are left alone. Safe to re-run.
create or replace function public.trg_donor_address_from_mailing()
returns trigger
language plpgsql
as $$
declare
  v_line text;
begin
  if coalesce(trim(new.mailing_address_line1), '') <> '' or coalesce(trim(new.mailing_address_line2), '') <> ''
     or coalesce(trim(new.mailing_city), '') <> '' or coalesce(trim(new.mailing_state), '') <> '' or coalesce(trim(new.mailing_zip), '') <> '' then
    v_line := concat_ws(', ',
      nullif(trim(new.mailing_address_line1), ''),
      nullif(trim(new.mailing_address_line2), ''),
      nullif(trim(new.mailing_city), ''),
      nullif(trim(concat_ws(' ', nullif(trim(new.mailing_state), ''), nullif(trim(new.mailing_zip), ''))), ''));
    new.address := nullif(v_line, '');
  end if;
  return new;
end;
$$;

drop trigger if exists donor_address_from_mailing on public.donors;
create trigger donor_address_from_mailing
  before insert or update of mailing_address_line1, mailing_address_line2, mailing_city, mailing_state, mailing_zip on public.donors
  for each row execute function public.trg_donor_address_from_mailing();
