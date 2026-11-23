-- Each sign-up form can feed more than one Constant Contact list: [{ "id": "...", "name": "..." }, ...]
alter table public.cc_connection add column if not exists newsletter_lists jsonb not null default '[]'::jsonb;
alter table public.cc_connection add column if not exists volunteer_lists jsonb not null default '[]'::jsonb;
update public.cc_connection set
  newsletter_lists = case when newsletter_list_id is not null and newsletter_lists = '[]'::jsonb then jsonb_build_array(jsonb_build_object('id', newsletter_list_id, 'name', coalesce(newsletter_list_name, ''))) else newsletter_lists end,
  volunteer_lists = case when volunteer_list_id is not null and volunteer_lists = '[]'::jsonb then jsonb_build_array(jsonb_build_object('id', volunteer_list_id, 'name', coalesce(volunteer_list_name, ''))) else volunteer_lists end
where id = 1;
