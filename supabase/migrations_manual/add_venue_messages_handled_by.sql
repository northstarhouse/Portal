-- Run once in the Supabase SQL editor.
-- Records who (Jen or Derek) handled or replied to a message from a couple's event page.
alter table venue_messages add column if not exists handled_by text;
