-- Feature requests can now also be bug reports, and can carry screenshots / files. Safe to re-run.
--   kind         'feature' (default) or 'bug'
--   attachments  [{ "name": "...", "url": "..." }, ...]  (files are stored in the board-attachments bucket under feature-requests/)
alter table public.feature_requests add column if not exists kind text not null default 'feature';
alter table public.feature_requests add column if not exists attachments jsonb not null default '[]'::jsonb;
