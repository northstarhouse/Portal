-- "Didn't show up" is a tour status the Portal sets (Upcoming Tours > Didn't show up); the check constraint did not allow it, so the update was refused.
alter table public.estate_tours drop constraint if exists estate_tours_status_check;
alter table public.estate_tours add constraint estate_tours_status_check
  check (status = any (array['open','booked','blocked','requested','cancelled','no_show']));
