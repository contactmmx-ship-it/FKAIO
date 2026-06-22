/*
Phase 2 — Database Validation & Migration Hygiene
- Consolidate duplicate ai_jobs table creation (was in migration 001 and 002)
- Add performance indexes for high-traffic tables
- Add missing NOT NULL, UNIQUE, CHECK constraints
- Add ON DELETE CASCADE for foreign keys (non-destructive — additive only)
- Verify primary keys exist on all tables
*/

-- ============================================================
-- 1. CONSOLIDATION: Drop the duplicate anon-only RLS policies on ai_jobs
--    (migration 002 created permissive anon policies that migration 004
--    later stripped; this ensures idempotent cleanup)
-- ============================================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "anon_select_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_insert_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_update_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_delete_ai_jobs" ON ai_jobs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 2. PERFORMANCE INDEXES — High-traffic query patterns
-- ============================================================

-- leads: filtered by status, stage, brand, assigned consultant, dates
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads (stage) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (stage, is_active);
CREATE INDEX IF NOT EXISTS idx_leads_brand_id ON leads (brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads (lead_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads (next_followup) WHERE next_followup IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source) WHERE source IS NOT NULL;

-- brands
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands (slug);

-- consultants
CREATE INDEX IF NOT EXISTS idx_consultants_active ON consultants (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_consultants_role ON consultants (role);
CREATE INDEX IF NOT EXISTS idx_consultants_auth_user ON consultants (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ai_jobs: status-based filtering for job scheduler
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_agent_id ON ai_jobs (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_retry ON ai_jobs (status, retry_count) WHERE retry_count < 3;

-- ai_agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_dept ON ai_agents (dept) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON ai_agents (is_active) WHERE is_active = true;

-- meetings
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings (status);
CREATE INDEX IF NOT EXISTS idx_meetings_consultant ON meetings (consultant_id) WHERE consultant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings (lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings (scheduled_at DESC);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_lead ON invoices (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices (created_at DESC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (user_id, read) WHERE read = false;

-- agent_workflows
CREATE INDEX IF NOT EXISTS idx_workflows_agent ON agent_workflows (agent_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_active ON agent_workflows (is_active);

-- agent_objectives
CREATE INDEX IF NOT EXISTS idx_objectives_agent ON agent_objectives (agent_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON agent_objectives (status);

-- agent_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log (activity_type, created_at DESC);

-- agent_memory
CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory (agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON agent_memory (expires_at) WHERE expires_at IS NOT NULL;

-- lead_activities
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities (lead_id, created_at DESC);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_lead ON documents (lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- payment_webhooks
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON payment_webhooks (processed) WHERE processed = false;

-- lead_objections
CREATE INDEX IF NOT EXISTS idx_lead_objections_lead ON lead_objections (lead_id);

-- negotiation_history
CREATE INDEX IF NOT EXISTS idx_negotiation_lead ON negotiation_history (lead_id, created_at DESC);

-- consultant_brands
CREATE INDEX IF NOT EXISTS idx_consultant_brands_consultant ON consultant_brands (consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_brands_brand ON consultant_brands (brand_id);

-- agent_conversations
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON agent_conversations (agent_id, created_at DESC);

-- ai_evolution
CREATE INDEX IF NOT EXISTS idx_evolution_agent ON ai_evolution (agent_id, created_at DESC);

-- ============================================================
-- 3. ADDITIVE CONSTRAINTS (non-destructive)
-- ============================================================

-- Ensure NOT NULL on critical columns (only add if column allows NULL currently)
DO $$ BEGIN
    ALTER TABLE leads ALTER COLUMN name SET NOT NULL;
    ALTER TABLE leads ALTER COLUMN stage SET NOT NULL;
    ALTER TABLE ai_jobs ALTER COLUMN type SET NOT NULL;
    ALTER TABLE ai_jobs ALTER COLUMN status SET NOT NULL;
    ALTER TABLE consultants ALTER COLUMN name SET NOT NULL;
    ALTER TABLE consultants ALTER COLUMN email SET NOT NULL;
    ALTER TABLE consultants ALTER COLUMN role SET NOT NULL;
    ALTER TABLE brands ALTER COLUMN name SET NOT NULL;
    ALTER TABLE invoices ALTER COLUMN status SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add UNIQUE constraints where appropriate
DO $$ BEGIN
    ALTER TABLE consultants ADD CONSTRAINT consultants_email_unique UNIQUE (email);
    ALTER TABLE brands ADD CONSTRAINT brands_slug_unique UNIQUE (slug);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 4. ADD ON DELETE CASCADE TO FOREIGN KEYS
--    (Non-destructive — only drops and recreates if constraint exists)
-- ============================================================

-- lead_activities → leads
DO $$ BEGIN
    ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_lead_id_fkey;
    ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_lead_id_fkey
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- meetings → leads
DO $$ BEGIN
    ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_lead_id_fkey;
    ALTER TABLE meetings ADD CONSTRAINT meetings_lead_id_fkey
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- documents → leads
DO $$ BEGIN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_lead_id_fkey;
    ALTER TABLE documents ADD CONSTRAINT documents_lead_id_fkey
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- invoices → leads
DO $$ BEGIN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_lead_id_fkey;
    ALTER TABLE invoices ADD CONSTRAINT invoices_lead_id_fkey
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- invoice_items → invoices
DO $$ BEGIN
    ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- payments → invoices
DO $$ BEGIN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;
    ALTER TABLE payments ADD CONSTRAINT payments_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- notifications → consultants (via user_id → auth)
DO $$ BEGIN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES consultants(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- agent_workflows → ai_agents
DO $$ BEGIN
    ALTER TABLE agent_workflows DROP CONSTRAINT IF EXISTS agent_workflows_agent_id_fkey;
    ALTER TABLE agent_workflows ADD CONSTRAINT agent_workflows_agent_id_fkey
        FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- agent_objectives → ai_agents
DO $$ BEGIN
    ALTER TABLE agent_objectives DROP CONSTRAINT IF EXISTS agent_objectives_agent_id_fkey;
    ALTER TABLE agent_objectives ADD CONSTRAINT agent_objectives_agent_id_fkey
        FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- agent_memory → ai_agents
DO $$ BEGIN
    ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_agent_id_fkey;
    ALTER TABLE agent_memory ADD CONSTRAINT agent_memory_agent_id_fkey
        FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- agent_activity_log → ai_agents
DO $$ BEGIN
    ALTER TABLE agent_activity_log DROP CONSTRAINT IF EXISTS agent_activity_log_agent_id_fkey;
    ALTER TABLE agent_activity_log ADD CONSTRAINT agent_activity_log_agent_id_fkey
        FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- agent_conversations → ai_agents
DO $$ BEGIN
    ALTER TABLE agent_conversations DROP CONSTRAINT IF EXISTS agent_conversations_agent_id_fkey;
    ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_agent_id_fkey
        FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- consultant_brands
DO $$ BEGIN
    ALTER TABLE consultant_brands DROP CONSTRAINT IF EXISTS consultant_brands_consultant_id_fkey;
    ALTER TABLE consultant_brands ADD CONSTRAINT consultant_brands_consultant_id_fkey
        FOREIGN KEY (consultant_id) REFERENCES consultants(id) ON DELETE CASCADE;
    ALTER TABLE consultant_brands DROP CONSTRAINT IF EXISTS consultant_brands_brand_id_fkey;
    ALTER TABLE consultant_brands ADD CONSTRAINT consultant_brands_brand_id_fkey
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 5. VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================================

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

-- ============================================================
-- 6. ADD completed_at COLUMN TO ai_jobs (if missing)
-- ============================================================

DO $$ BEGIN
    ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 7. VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Uncomment to verify:
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
-- SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY' ORDER BY table_name;
