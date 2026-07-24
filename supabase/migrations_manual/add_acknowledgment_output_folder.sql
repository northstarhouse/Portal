-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Replaces the donor-per-folder Drive layout with a single "[Month Year]" folder shared by
-- everyone's letters that month, inside one admin-chosen destination folder (not necessarily
-- a whole Shared Drive -- a single shared folder the service account has access to works too).

alter table acknowledgment_settings
  add column if not exists output_folder_id text,
  add column if not exists output_folder_name text;

-- Point at the "Acknowledgement Templates" folder already in use:
-- https://drive.google.com/drive/folders/1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx
update acknowledgment_settings
  set output_folder_id = '1M4p35h-L_V0Ikgz2YNJh5eklp62Dp0wx',
      output_folder_name = 'Acknowledgement Templates'
  where output_folder_id is null;

-- shared_drive_id / root_folder_name / root_folder_cache_id (from the original migration) are
-- no longer read by the Edge Function's folder-resolution logic -- left in place harmlessly
-- rather than dropped, in case they're wanted again later.
