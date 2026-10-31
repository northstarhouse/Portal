-- Run once in the Supabase SQL editor.
-- Lets the venue@ inbox import (sync-venue-inbox function) file each email only once.
-- There is no timer: the Portal checks the inbox when staff open Venue Rentals / Messages, so nothing runs in the background.
alter table venue_messages add column if not exists gmail_id text;
create unique index if not exists venue_messages_gmail_id_key on venue_messages (gmail_id);
