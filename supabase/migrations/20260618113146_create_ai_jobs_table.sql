/*
# Consolidation: ai_jobs table migration
#
# The original ai_jobs table was created in migration 20260618111535 (main schema)
# which has the correct schema including agent_id, error, brand_id columns.
#
# This file previously contained a DUPLICATE CREATE TABLE that was skipped
# (due to IF NOT EXISTS) and had permissive USING(true) RLS policies.
#
# This migration:
# 1. Adds any columns that the main schema has but this file's version lacked
# 2. Replaces permissive RLS policies with role-scoped policies (matching Phase 3 audit)
# 3. Adds performance indexes
*/

-- Ensure columns that exist in the main schema but may be missing here
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS cost_usd numeric(10, 6) DEFAULT 0;
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS duration_ms integer;

-- Drop permissive USING(true) policies (security fix from Phase 3 RLS audit)
DROP POLICY IF EXISTS "anon_select_ai_jobs" ON ai_jobs;
DROP POLICY IF EXISTS "anon_insert_ai_jobs" ON ai_jobs;
DROP POLICY IF EXISTS "anon_update_ai_jobs" ON ai_jobs;
DROP POLICY IF EXISTS "anon_delete_ai_jobs" ON ai_jobs;

-- Replace with proper role-scoped policies
-- Authenticated users can read AI jobs (for monitoring dashboards)
CREATE POLICY "auth_select_ai_jobs" ON ai_jobs FOR SELECT
TO authenticated USING (true);

-- Only service_role (edge functions) can write to ai_jobs
CREATE POLICY "service_insert_ai_jobs" ON ai_jobs FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.jwt() WHERE (payload ->> 'role') = 'service_role')
);

CREATE POLICY "service_update_ai_jobs" ON ai_jobs FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.jwt() WHERE (payload ->> 'role') = 'service_role')
);

CREATE POLICY "service_delete_ai_jobs" ON ai_jobs FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.jwt() WHERE (payload ->> 'role') = 'service_role')
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_agent_id ON ai_jobs(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_brand_id ON ai_jobs(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);
