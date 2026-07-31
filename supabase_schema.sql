-- Supabase/Postgres schema for a typical app
-- Includes: extensions, profiles, organizations, projects, memberships, tasks, files

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Utility function to keep updated_at current
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  email text,
  bio text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_uid ON profiles(auth_uid);

CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

CREATE TRIGGER trg_organizations_updated
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Projects within organizations
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  summary text,
  config jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  archived boolean NOT NULL DEFAULT false,
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

CREATE TRIGGER trg_projects_updated
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Memberships: which profiles belong to which organizations
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_profile ON memberships(profile_id);

CREATE TRIGGER trg_memberships_updated
BEFORE UPDATE ON memberships
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tasks (example domain table)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  priority smallint DEFAULT 3,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

CREATE TRIGGER trg_tasks_updated
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Files attached to entities
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  url text NOT NULL,
  size bigint,
  content_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

-- Audit log (lightweight)
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Example view: project summary with counts
CREATE OR REPLACE VIEW project_summaries AS
SELECT
  p.id as project_id,
  p.organization_id,
  p.name,
  p.slug,
  p.created_at,
  p.updated_at,
  COUNT(t.*) FILTER (WHERE t.status <> 'closed') AS open_tasks,
  COUNT(f.*) AS file_count
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
LEFT JOIN files f ON f.project_id = p.id
GROUP BY p.id;

-- Optional: row-level security examples (commented)
-- To enable RLS you would run:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- And then add policies tailored to your auth model.

-- End of schema
