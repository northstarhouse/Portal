-- Password for the Events Committee voting "Admin" (close / delete votes, see votes before they are revealed).
-- The password is stored hashed (never in the app code or in this file) and checked by verify_vote_admin_password().
-- Until a password is set, Admin stays locked for everyone.
--
-- TO SET OR CHANGE THE PASSWORD, run this once in the Supabase SQL editor, putting your password between the quotes:
--
--   insert into events_vote_admin (id, hash) values (1, extensions.crypt('YOUR PASSWORD HERE', extensions.gen_salt('bf')))
--   on conflict (id) do update set hash = excluded.hash;
--
-- (Do not save the real password in a file or commit it.)

create table if not exists events_vote_admin (
  id   int primary key default 1 check (id = 1),
  hash text not null
);
alter table events_vote_admin enable row level security;   -- no policies: nobody can read the hash

create or replace function public.verify_vote_admin_password(p_password text)
returns boolean
language sql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  select exists (select 1 from public.events_vote_admin where hash = extensions.crypt(p_password, hash));
$$;

revoke all on function public.verify_vote_admin_password(text) from public, anon;
grant execute on function public.verify_vote_admin_password(text) to authenticated;
