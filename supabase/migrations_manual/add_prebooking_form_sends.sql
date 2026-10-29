-- Record of pre-booking forms emailed from the Portal's Venue Rentals > Inquiries list (send-prebooking-form function).
-- Written by the function only; the Portal reads it to show "Pre-booking form sent".
create table if not exists prebooking_form_sends (
  response_id uuid primary key references nsh_form_responses(id) on delete cascade,
  email       text not null,
  form_url    text,
  sent_at     timestamptz not null default now()
);
alter table prebooking_form_sends enable row level security;
drop policy if exists "portal session read prebooking_form_sends" on prebooking_form_sends;
create policy "portal session read prebooking_form_sends" on prebooking_form_sends for select to anon using (public.has_valid_app_session());
