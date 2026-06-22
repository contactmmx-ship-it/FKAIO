-- ============================================================================
-- Phase A: Project Registry & Migration Log
-- ============================================================================
-- Central catalogue of all 13 known projects being migrated into the FKAIOS
-- unified platform.  Tracks migration status, priority ordering, and a full
-- audit log of every data-migration step executed against the schema.
--
-- Tables created:
--   project_registry  — One row per project (module / document / reference)
--   migration_log     — Append-only log of every migration operation
--
-- Depends on: is_admin() from 20260619120000_phase0_security_rbac.sql
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Reusable updated_at trigger function
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
'Generic trigger: sets updated_at = now() on every INSERT / UPDATE.';

-- ──────────────────────────────────────────────
-- 2. project_registry
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_registry (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name     TEXT        NOT NULL,
  project_slug     TEXT        UNIQUE NOT NULL,
  project_type     TEXT        NOT NULL CHECK (project_type IN ('document', 'module', 'reference')),
  source_location  TEXT,
  description      TEXT,
  brand_ids        UUID[],
  migration_status TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (migration_status IN ('pending', 'in_progress', 'completed', 'failed', 'retired')),
  integration_status TEXT      NOT NULL DEFAULT 'not_started'
                               CHECK (integration_status IN ('not_started', 'in_progress', 'integrated', 'failed')),
  priority         INTEGER     NOT NULL DEFAULT 50,
  metadata         JSONB       DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.project_registry IS
'Phase A: Central registry of every project (module / document / reference)
being migrated into the FKAIOS unified platform.';

COMMENT ON COLUMN public.project_registry.project_slug IS
'URL-safe unique identifier derived from project_name.';

COMMENT ON COLUMN public.project_registry.brand_ids IS
'UUIDs of brands this project relates to (denormalised for fast lookup).';

COMMENT ON COLUMN public.project_registry.priority IS
'Lower number = higher priority. Range 0-100.';

COMMENT ON COLUMN public.project_registry.metadata IS
'Arbitrary JSONB for migration notes, version tags, external links, etc.';

-- Enable RLS
ALTER TABLE public.project_registry ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
DROP POLICY IF EXISTS "select_project_registry" ON public.project_registry;
CREATE POLICY "select_project_registry" ON public.project_registry
  FOR SELECT TO authenticated USING (true);

-- INSERT: admin only
DROP POLICY IF EXISTS "insert_project_registry" ON public.project_registry;
CREATE POLICY "insert_project_registry" ON public.project_registry
  FOR INSERT TO authenticated WITH CHECK (is_admin());

-- UPDATE: admin only
DROP POLICY IF EXISTS "update_project_registry" ON public.project_registry;
CREATE POLICY "update_project_registry" ON public.project_registry
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "delete_project_registry" ON public.project_registry;
CREATE POLICY "delete_project_registry" ON public.project_registry
  FOR DELETE TO authenticated USING (is_admin());

-- ──────────────────────────────────────────────
-- 3. migration_log
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.migration_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_registry_id UUID       REFERENCES public.project_registry(id) ON DELETE SET NULL,
  source_table       TEXT        NOT NULL,
  target_table       TEXT        NOT NULL,
  operation          TEXT        NOT NULL CHECK (operation IN (
                       'create_table', 'copy_data', 'transform', 'validate', 'backup', 'cleanup'
                     )),
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
  rows_affected      INTEGER,
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  executed_by        UUID        REFERENCES auth.users(id),
  metadata           JSONB       DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.migration_log IS
'Phase A: Append-only audit log of every data-migration operation.
Each row represents a single migration step (copy, transform, validate, …).';

COMMENT ON COLUMN public.migration_log.project_registry_id IS
'FK to project_registry. NULL if the log entry is not tied to a specific project.';

COMMENT ON COLUMN public.migration_log.operation IS
'Type of migration step. See CHECK constraint for valid values.';

-- Enable RLS
ALTER TABLE public.migration_log ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
DROP POLICY IF EXISTS "select_migration_log" ON public.migration_log;
CREATE POLICY "select_migration_log" ON public.migration_log
  FOR SELECT TO authenticated USING (true);

-- INSERT: admin only
DROP POLICY IF EXISTS "insert_migration_log" ON public.migration_log;
CREATE POLICY "insert_migration_log" ON public.migration_log
  FOR INSERT TO authenticated WITH CHECK (is_admin());

-- UPDATE: admin only
DROP POLICY IF EXISTS "update_migration_log" ON public.migration_log;
CREATE POLICY "update_migration_log" ON public.migration_log
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- NOTE: No DELETE policy on migration_log — audit trail must be immutable.
-- Only service_role (which bypasses RLS) can delete.

-- ──────────────────────────────────────────────
-- 4. updated_at triggers
-- ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_project_registry_updated_at ON public.project_registry;
CREATE TRIGGER trg_project_registry_updated_at
  BEFORE UPDATE ON public.project_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_migration_log_updated_at ON public.migration_log;
CREATE TRIGGER trg_migration_log_updated_at
  BEFORE UPDATE ON public.migration_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- 5. Indexes
-- ──────────────────────────────────────────────
-- project_registry: filter by type + migration status (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_project_registry_type_migration_status
  ON public.project_registry (project_type, migration_status);

-- migration_log: look up steps for a project filtered by status
CREATE INDEX IF NOT EXISTS idx_migration_log_project_status
  ON public.migration_log (project_registry_id, status);

-- ──────────────────────────────────────────────
-- 6. Seed data — 13 known projects
-- ──────────────────────────────────────────────
INSERT INTO public.project_registry (
  project_name,
  project_slug,
  project_type,
  source_location,
  description,
  migration_status,
  integration_status,
  priority,
  metadata
) VALUES

  -- Priority 90 — highest: feeds Phase F
  ('FK CashFlow AI', 'fk-cashflow-ai', 'module',
   'Supabase / external',
   'AI-powered cash-flow forecasting module. Highest priority — feeds directly into Phase F financial pipeline.',
   'pending', 'not_started', 90,
   '{"phase_dependency": "F", "notes": "Feeds Phase F financial pipeline. Must migrate first."}'),

  -- Priority 85 — feeds Phase G
  ('Chairman Partner OS', 'chairman-partner-os', 'module',
   'Supabase',
   'Partner onboarding and lifecycle management OS. High priority — feeds Phase G partner integration.',
   'pending', 'not_started', 85,
   '{"phase_dependency": "G", "notes": "Feeds Phase G partner integration."}'),

  -- Priority 70 — most SOP material for Phase B
  ('Arofur Systems', 'arofur-systems', 'module',
   'Supabase',
   'Operational system containing the richest SOP material. Primary source for Phase B knowledge extraction.',
   'pending', 'not_started', 70,
   '{"phase_dependency": "B", "notes": "Most SOP material — primary source for Phase B knowledge extraction."}'),

  -- Priority 60
  ('Turning Point CRM', 'turning-point-crm', 'module',
   'Supabase',
   'CRM for Turning Point brand. Contains lead and customer interaction history.',
   'pending', 'not_started', 60,
   '{"phase_dependency": null}'),

  -- Priority 50 (default)
  ('Brand Readiness Scanner', 'brand-readiness-scanner', 'module',
   'Supabase',
   'Scans brand profiles and scores readiness for onboarding or audit.',
   'pending', 'not_started', 50,
   '{"phase_dependency": null}'),

  -- Priority 40
  ('GoMax BOS', 'go-max-bos', 'module',
   'Supabase',
   'Business Operating System for GoMax brand.',
   'pending', 'not_started', 40,
   '{"phase_dependency": null}'),

  ('AAROHA', 'aaroha', 'document',
   'Google Docs / Drive',
   'Foundational AAROHA document — brand guidelines, vision, and operational charter.',
   'pending', 'not_started', 40,
   '{"phase_dependency": null, "source_type": "google_docs"}'),

  -- Priority 35
  ('Bharat Paints OS', 'bharat-paints-os', 'module',
   'Supabase',
   'Business Operating System for Bharat Paints brand.',
   'pending', 'not_started', 35,
   '{"phase_dependency": null}'),

  -- Priority 30
  ('Gio Paints MBEP', 'gio-paints-mbep', 'module',
   'Supabase',
   'MBEP (Micro-Brand Expansion Program) module for Gio Paints.',
   'pending', 'not_started', 30,
   '{"phase_dependency": null}'),

  ('TODLLER', 'todller', 'module',
   'Supabase',
   'TODLLER brand module — product and order management.',
   'pending', 'not_started', 30,
   '{"phase_dependency": null}'),

  ('AVG Exchange', 'avg-exchange', 'module',
   'Supabase',
   'Exchange/trading module for AVG brand.',
   'pending', 'not_started', 30,
   '{"phase_dependency": null}'),

  ('Chaat Masters OS', 'chaat-masters-os', 'module',
   'Supabase',
   'Business Operating System for Chaat Masters brand.',
   'pending', 'not_started', 30,
   '{"phase_dependency": null}'),

  -- Priority 20
  ('FK Master Dashboard', 'fk-master-dashboard', 'reference',
   'Supabase',
   'Cross-brand reference dashboard. Aggregates KPIs from all brands. Lowest priority — depends on other modules.',
   'pending', 'not_started', 20,
   '{"phase_dependency": null, "notes": "Depends on all other modules being migrated first."}')

ON CONFLICT (project_slug) DO NOTHING;