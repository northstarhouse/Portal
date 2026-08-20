-- Run this once in the Supabase SQL editor.
-- Makes Operational Area budgets editable in-app (Admin -> Operational
-- Budgets) instead of hardcoded in AREA_DEFAULTS in src/app.jsx. Seeded
-- with the current hardcoded values so nothing changes until someone edits.

create table if not exists operational_area_budgets (
  area       text primary key,
  lead       text,
  lead_email text,
  budget     numeric,
  pic        text,
  updated_at timestamptz default now()
);

alter table operational_area_budgets enable row level security;

create policy "public read"   on operational_area_budgets for select using (true);
create policy "public insert" on operational_area_budgets for insert with check (true);
create policy "public update" on operational_area_budgets for update using (true);
create policy "public delete" on operational_area_budgets for delete using (true);

insert into operational_area_budgets (area, lead, lead_email, budget, pic) values
  ('Construction', 'Rick Panos',      null, 12000, 'https://drive.google.com/file/d/1hbFJxUUQEsuhoWnTDeARg6peSHCpiBFH/view?usp=drive_link'),
  ('Grounds',      'Paula Campbell',  null, 14000, 'https://drive.google.com/file/d/17J0cF_okHkAs_HCRjuYm0TnpM0v8Ek5-/view?usp=sharing'),
  ('Interiors',    'Bec Freeman',     null, 2500,  'https://drive.google.com/file/d/1PsjDfGQLqDF9BVc5wuBd-Qx9D5E0Hvf4/view?usp=drive_link'),
  ('Docents',      'Rich Hill',       null, 1000,  'https://drive.google.com/file/d/1gBzqnzekKkTLn8mnn2mxt-PqAeeMZSJs/view?usp=drive_link'),
  ('Fundraising',  'Kaelen Jennings', null, null,  null),
  ('Events',       'Barb Kusha',      null, 7500,  null),
  ('Marketing',    'Haley Wright',    null, 1000,  'https://drive.google.com/file/d/17Tse_3jiKZwmkVTTKMtt64zDghfZ8WrV/view?usp=drive_link'),
  ('Venue',        'Staff',           null, null,  null)
on conflict (area) do nothing;
