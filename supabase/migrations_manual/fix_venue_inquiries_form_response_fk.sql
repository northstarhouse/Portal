-- Run this once in the Supabase SQL editor.
-- venue_inquiries links back to nsh_form_responses via four FK columns
-- (form_response_id, prebooking_form_response_id, questionnaire_form_response_id,
-- feedback_form_response_id), all with the default NO ACTION -- so deleting
-- ANY inquiry/wedding/event/pre-booking form response that a venue_inquiries
-- row references failed with a foreign-key violation (23503), even though
-- the Delete button in both the Venue Inquiries page and the generic Form
-- Responses browser looked like it should work and gave no visible error.
--
-- Switching to ON DELETE SET NULL means deleting a raw form submission just
-- detaches it from the tracked inquiry (nulls that one field) instead of
-- being blocked -- it does NOT delete the venue_inquiries row itself, so
-- payment/proposal/insurance history on a real booking is never lost.

alter table venue_inquiries drop constraint venue_inquiries_form_response_id_fkey;
alter table venue_inquiries add constraint venue_inquiries_form_response_id_fkey
  foreign key (form_response_id) references nsh_form_responses(id) on delete set null;

alter table venue_inquiries drop constraint venue_inquiries_prebooking_form_response_id_fkey;
alter table venue_inquiries add constraint venue_inquiries_prebooking_form_response_id_fkey
  foreign key (prebooking_form_response_id) references nsh_form_responses(id) on delete set null;

alter table venue_inquiries drop constraint venue_inquiries_questionnaire_form_response_id_fkey;
alter table venue_inquiries add constraint venue_inquiries_questionnaire_form_response_id_fkey
  foreign key (questionnaire_form_response_id) references nsh_form_responses(id) on delete set null;

alter table venue_inquiries drop constraint venue_inquiries_feedback_form_response_id_fkey;
alter table venue_inquiries add constraint venue_inquiries_feedback_form_response_id_fkey
  foreign key (feedback_form_response_id) references nsh_form_responses(id) on delete set null;
