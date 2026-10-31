-- Run once in the Supabase SQL editor.
-- Removes anything already imported from senders we now filter out (Eventective, Global Event Supply, PayPal).
delete from venue_messages
where gmail_id is not null
  and (from_email ilike '%eventective%' or from_email ilike '%globaleventsupply%' or from_email ilike '%paypal%');
