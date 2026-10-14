-- MVP schema: 8 tabel inti + 1 view helper. PostgreSQL 15+.
-- research_logs: append-only (jangan buat UPDATE/DELETE API). RLS opsional, app-level check wajib.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  research_type TEXT NOT NULL DEFAULT 'Skripsi' CHECK (research_type IN ('Skripsi','Tesis','Disertasi','Paper','Lainnya')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv','xlsx','xls','sav','json')),
  size_bytes BIGINT NOT NULL,
  rows_count INT,
  cols_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  parent_version_id UUID REFERENCES dataset_versions(id),
  transformation_log JSONB NOT NULL DEFAULT '[]',
  active_columns JSONB,
  storage_path TEXT, -- NULL = file asli dataset (v1); vN+ = CSV hasil transformasi
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, version_number)
);

CREATE TABLE IF NOT EXISTS variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  var_type TEXT NOT NULL CHECK (var_type IN ('Numerical','Ordinal','Nominal','Binary','Text','Datetime','ID')),
  var_role TEXT NOT NULL DEFAULT 'Ignore' CHECK (var_role IN ('Independent','Dependent','Control','Grouping','ID','Ignore')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dataset_version_id, name)
);

CREATE TABLE IF NOT EXISTS research_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  goal_category TEXT NOT NULL,
  design_hints JSONB NOT NULL DEFAULT '{}',
  user_question TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_research_intents_project_id ON research_intents(project_id);

CREATE TABLE IF NOT EXISTS analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  research_intent_id UUID REFERENCES research_intents(id) ON DELETE SET NULL,
  dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  variables JSONB NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  preprocessing_ops JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  source_mode TEXT NOT NULL,
  wizard_step INTEGER NOT NULL DEFAULT 0,
  preflight_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_analysis_configs_project_id ON analysis_configs(project_id);

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id),
  analysis_config_id UUID REFERENCES analysis_configs(id),
  analysis_uid TEXT UNIQUE NOT NULL, -- format ANL-YYYYMMDD-XXXXXX
  method TEXT NOT NULL,
  variables JSONB NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('queued','running','done','failed')),
  analysis_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project_id);
CREATE INDEX IF NOT EXISTS ix_analyses_analysis_config_id ON analyses(analysis_config_id);

CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID UNIQUE NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  result_hash TEXT NOT NULL,
  software_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('csv','xlsx','pdf','docx','tex','json')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id),
  method TEXT NOT NULL,
  variables JSONB NOT NULL,
  params JSONB NOT NULL,
  software_version TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Sengaja tanpa UPDATE/DELETE grant untuk app role di prod (append-only).
