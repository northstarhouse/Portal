-- Form Responses: each form can be hidden from the main list and kept in its own "Hidden" bucket (Portal > Form Responses).
-- Replaces the hard-coded hidden lists in the Portal. Safe to re-run.
--
-- Starts with exactly what was hidden before: every Wedding-category form, the Memorial / Private Event / Non-Profit Event /
-- Public Event inquiry forms, and both pre-booking forms. Hiding only affects the Form Responses list and its unread count;
-- the forms keep collecting responses and everything still shows in Venue Rentals.
alter table public.nsh_forms add column if not exists portal_hidden boolean not null default false;

update public.nsh_forms set portal_hidden = true
where category = 'Wedding'
   or id in (
     '952bc156-e89d-4790-814d-d2c2e9738a8b',  -- Memorial Inquiry
     '5b886667-5230-4866-9874-7bc0dcdb3320',  -- Private Event Inquiry
     'e8cc69a1-1693-4fb4-8518-b8bb486dd055',  -- Non-Profit Event Inquiry
     'cd8f1e9f-06c5-4369-8b66-3498aff31465',  -- Public Event Inquiry
     'a3a383f7-e1db-4344-9dec-ea879ad3406d',  -- Pre-Booking Information Form (weddings)
     '668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8'   -- Pre Booking Information Form (Events)
   );
