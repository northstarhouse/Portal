-- Lets the Portal's Sponsors page add / update a sponsor on the public website's Sponsors page when a logo,
-- website or overview is saved. The Portal does this by editing site_content's "sponsors" row; without an update
-- rule that edit was silently ignored. Scope: only the "sponsors" row, only for a valid Portal session.
drop policy if exists "portal session update sponsors page" on site_content;
create policy "portal session update sponsors page"
  on site_content for update
  to anon
  using (page_key = 'sponsors' and public.has_valid_app_session())
  with check (page_key = 'sponsors' and public.has_valid_app_session());
