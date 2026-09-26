-- Run this once in the Supabase SQL editor.
-- nsh_form_responses had read/insert/delete policies but no UPDATE policy,
-- so PATCH requests (marking a response "handled", saving internal notes)
-- were silently no-ops under RLS: Postgrest returns 200 OK with zero rows
-- actually updated, so the UI looked like it saved until the next reload.

create policy "public update" on nsh_form_responses for update using (true) with check (true);
