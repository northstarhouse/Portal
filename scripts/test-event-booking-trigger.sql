-- Dry run (everything is rolled back): fill the events pre-booking form the way staff do, and show the booking the trigger makes.
begin;
insert into nsh_form_responses (form_id, answers) values
  ('668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8',
   '{"evp_org":"ZZ TEST Org","evp_name":"Test Person","evp_email":"zz-test-trigger@example.com","evp_phone":"5305550100","evp_date":"2027-06-05","__entered_by_staff":{"by":"test"}}'::jsonb);
select v.name, v.event_type, v.event_date, v.status, v.source, v.prebooking_form_response_id is not null as linked
from venue_inquiries v where v.email = 'zz-test-trigger@example.com';
rollback;
