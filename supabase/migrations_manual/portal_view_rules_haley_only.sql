-- Only Haley Wright's Portal session can create, change or delete personalized-view rules.
-- Everyone signed in can still READ the rules (the Portal needs to read the signed-in person's own rule on load). Safe to re-run.
drop policy if exists token_can_write on public.portal_view_rules;
drop policy if exists haley_can_insert on public.portal_view_rules;
drop policy if exists haley_can_update on public.portal_view_rules;
drop policy if exists haley_can_delete on public.portal_view_rules;
create policy haley_can_insert on public.portal_view_rules for insert to anon, authenticated with check (public.app_session_name() = 'Haley Wright');
create policy haley_can_update on public.portal_view_rules for update to anon, authenticated using (public.app_session_name() = 'Haley Wright') with check (public.app_session_name() = 'Haley Wright');
create policy haley_can_delete on public.portal_view_rules for delete to anon, authenticated using (public.app_session_name() = 'Haley Wright');
