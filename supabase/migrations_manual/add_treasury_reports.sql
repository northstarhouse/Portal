-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb)
-- Backs the Treasury Reports view (P&L, Balance Sheet, Budget vs Actual snapshots)
-- reachable from Financial Overview. Each row is one report snapshot for one period,
-- entered via the Admin panel's paste-and-parse tool. No more hardcoded numbers in
-- the frontend -- the dashboard reads whatever is stored here.

create table if not exists treasury_reports (
  id bigint generated always as identity primary key,
  report_type text not null check (report_type in ('pl', 'bs', 'budget')),
  period_key text not null,
  tab_label text,
  full_label text,
  as_of_date date,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists treasury_reports_type_period_idx
  on treasury_reports(report_type, period_key);

create index if not exists treasury_reports_type_asof_idx
  on treasury_reports(report_type, as_of_date);
