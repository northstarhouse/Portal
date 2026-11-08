-- Empire Club (Catharine Bramkamp): link their two pre-booking forms to booking records so their venue codes work.
-- Spring Party = MAR-20-2027, Christmas Party = DEC-18-2027.
--
-- Why the codes failed: the venue code page only finds events that have a booking record (venue_inquiries) linked to the
-- pre-booking form response. Wedding forms create that record automatically; the events pre-booking form does not, and
-- these two responses (nsh_form_responses 0bbc5908... and 0b6398f9...) had none.
-- Safe to re-run: it only adds a booking when none is linked to that response yet.

insert into venue_inquiries (name, email, phone, event_type, event_date, status, source, prebooking_form_response_id)
select coalesce(nullif(trim(r.answers->>'__event_name'), ''), r.answers->>'evp_org'),
       r.answers->>'evp_email', r.answers->>'evp_phone',
       'Private Event', (r.answers->>'evp_date')::date, 'Booking', 'website', r.id
from nsh_form_responses r
where r.id in ('0bbc5908-4685-4c82-a8ea-717c09407689', '0b6398f9-3009-410e-b135-c07a69131aa1')
  and not exists (select 1 from venue_inquiries v where v.prebooking_form_response_id = r.id);

select id, name, event_type, event_date, status, prebooking_form_response_id
from venue_inquiries
where prebooking_form_response_id in ('0bbc5908-4685-4c82-a8ea-717c09407689', '0b6398f9-3009-410e-b135-c07a69131aa1');
