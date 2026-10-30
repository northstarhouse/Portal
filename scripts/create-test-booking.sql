-- TEST BOOKING for trying the contract + event-page signing flow. Not a real couple.
-- Venue code for this booking: DEC-31-2027. Both signers' emails go to the NSH media inbox, so nothing reaches a real client.
-- Run in the Supabase SQL editor. The pre-booking trigger creates the booking and its payment schedule automatically.
insert into nsh_form_responses (id, form_id, answers, status)
values (
  gen_random_uuid(),
  'a3a383f7-e1db-4344-9dec-ea879ad3406d',
  jsonb_build_object(
    '7fnabd0i', 'Test Taylor',
    '7leui2ic', 'Test Jordan',
    'c9u1sxb4', 'media@thenorthstarhouse.org',
    'pt4mail1', 'media+jordan@thenorthstarhouse.org',
    '163otrai', '5305550100',
    'sn9urgfr', '2027-12-31'
  ),
  'handled'
);

-- To remove the test afterwards (run separately):
-- delete from venue_payment_schedule where inquiry_id in (select id from venue_inquiries where event_date = '2027-12-31' and name ilike 'Test %');
-- delete from venue_inquiries where event_date = '2027-12-31' and name ilike 'Test %';
-- delete from nsh_form_responses where form_id = 'a3a383f7-e1db-4344-9dec-ea879ad3406d' and answers->>'7fnabd0i' = 'Test Taylor';
