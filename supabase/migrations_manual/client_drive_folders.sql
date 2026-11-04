-- Where each venue client's paperwork is filed in Google Drive (client-drive-sync keeps it up to date).
-- Keyed by the client's pre-booking form response. Staff can read the folder link; only the function writes.
create table if not exists public.venue_drive_folders (
  response_id uuid primary key references public.nsh_form_responses(id) on delete cascade,
  folder_id text not null,
  folder_url text not null,
  folder_name text,
  created_at timestamptz not null default now()
);
alter table public.venue_drive_folders enable row level security;
drop policy if exists venue_drive_folders_read on public.venue_drive_folders;
create policy venue_drive_folders_read on public.venue_drive_folders for select using (has_valid_app_session());
