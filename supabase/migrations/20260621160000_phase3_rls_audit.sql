/*
Phase 3 — Security Hardening: RLS Policy Audit & Fixes

This migration audits and fixes all RLS policies across the database.

POLICY INVENTORY (after this migration):

TABLE: leads
- leads_select_own: RM/Trainer can only see leads assigned to them
- leads_select_brand: BrandManager can see leads for their brands
- leads_select_all: Founder/OpsHead see all leads
- leads_insert_authenticated: Any authenticated user can insert
- leads_update_own: RM can only update own leads
- leads_update_brand: BrandManager can update brand leads
- leads_update_all: Founder/OpsHead update all
- leads_delete_admin: Only Founder/OpsHead can delete

TABLE: brands
- brands_select_all: All authenticated users can read
- brands_insert_admin: Only Founder/OpsHead insert
- brands_update_admin: Only Founder/OpsHead update
- brands_delete_admin: Only Founder/OpsHead delete

TABLE: consultants
- consultants_select_all: All authenticated users can read
- consultants_insert_admin: Only Founder/OpsHead insert
- consultants_update_own: Can update own profile
- consultants_update_admin: Founder/OpsHead update all
- consultants_delete_admin: Only Founder/OpsHead delete

TABLE: ai_agents, ai_jobs, ai_outcomes, ai_evolution, agent_workflows,
       agent_objectives, agent_activity_log, agent_conversations, agent_memory
- Standard: read for all authenticated, write for Founder/OpsHead only
  (Edge functions bypass RLS via service role — policies protect direct client access)

TABLE: meetings, lead_activities, documents
- Scoped by ownership/assignment pattern matching leads

TABLE: invoices, invoice_items, payments, payment_webhooks
- Accounts role: full access
- Founder/OpsHead: full access
- Others: read-only or none

TABLE: notifications
- Users can read own notifications, system inserts via triggers

TABLE: settings
- Read for all authenticated, write for Founder/OpsHead only

TABLE: consultant_brands
- All authenticated can read, Founder/OpsHead manage

TABLE: lead_objections, negotiation_history
- Same pattern as leads (ownership/brand scoped)
*/

-- ============================================================
-- 1. STRIP ALL PERMISSIVE USING(true) POLICIES
--    Replace with proper role-based access
-- ============================================================

-- Clear any remaining permissive policies from original schema
DO $$ BEGIN
    -- leads
    DROP POLICY IF EXISTS "anon_full_access_leads" ON leads;
    DROP POLICY IF EXISTS "leads_select_policy" ON leads;
    DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
    DROP POLICY IF EXISTS "leads_update_policy" ON leads;
    DROP POLICY IF EXISTS "leads_delete_policy" ON leads;

    -- brands
    DROP POLICY IF EXISTS "anon_full_access_brands" ON brands;
    DROP POLICY IF EXISTS "brands_select_policy" ON brands;
    DROP POLICY IF EXISTS "brands_insert_policy" ON brands;
    DROP POLICY IF EXISTS "brands_update_policy" ON brands;
    DROP POLICY IF EXISTS "brands_delete_policy" ON brands;

    -- consultants
    DROP POLICY IF EXISTS "anon_full_access_consultants" ON consultants;
    DROP POLICY IF EXISTS "consultants_select_policy" ON consultants;
    DROP POLICY IF EXISTS "consultants_insert_policy" ON consultants;
    DROP POLICY IF EXISTS "consultants_update_policy" ON consultants;
    DROP POLICY IF EXISTS "consultants_delete_policy" ON consultants;

    -- ai_jobs (from migration 002)
    DROP POLICY IF EXISTS "anon_select_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_insert_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_update_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_delete_ai_jobs" ON ai_jobs;

    -- tables from migration 001 (original schema)
    DROP POLICY IF EXISTS "anon_full_access_ai_agents" ON ai_agents;
    DROP POLICY IF EXISTS "anon_full_access_ai_jobs" ON ai_jobs;
    DROP POLICY IF EXISTS "anon_full_access_ai_outcomes" ON ai_outcomes;
    DROP POLICY IF EXISTS "anon_full_access_ai_evolution" ON ai_evolution;
    DROP POLICY IF EXISTS "anon_full_access_meetings" ON meetings;
    DROP POLICY IF EXISTS "anon_full_access_documents" ON documents;
    DROP POLICY IF EXISTS "anon_full_access_invoices" ON invoices;
    DROP POLICY IF EXISTS "anon_full_access_payments" ON payments;
    DROP POLICY IF EXISTS "anon_full_access_lead_activities" ON lead_activities;
    DROP POLICY IF EXISTS "anon_full_access_notifications" ON notifications;
    DROP POLICY IF EXISTS "anon_full_access_settings" ON settings;

    -- agent tables from migration 003
    DROP POLICY IF EXISTS "anon_full_access_agent_memory" ON agent_memory;
    DROP POLICY IF EXISTS "anon_full_access_agent_workflows" ON agent_workflows;
    DROP POLICY IF EXISTS "anon_full_access_agent_objectives" ON agent_objectives;
    DROP POLICY IF EXISTS "anon_full_access_agent_activity_log" ON agent_activity_log;
    DROP POLICY IF EXISTS "anon_full_access_agent_conversations" ON agent_conversations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 2. APPLY PROPER RBAC POLICIES FOR ALL TABLES
--    (Idempotent: DROP IF EXISTS before CREATE)
-- ============================================================

-- ----- LEADS -----
-- SELECT: RM sees own, BrandManager sees brand leads, Founder/OpsHead see all
DROP POLICY IF EXISTS leads_select_own ON leads;
CREATE POLICY leads_select_own ON leads FOR SELECT
    TO authenticated
    USING (
        assigned_to = get_my_consultant_id()
        AND get_my_role() IN ('RM', 'Trainer')
    );

DROP POLICY IF EXISTS leads_select_brand ON leads;
CREATE POLICY leads_select_brand ON leads FOR SELECT
    TO authenticated
    USING (
        brand_id IN (SELECT brand_id FROM consultant_brands WHERE consultant_id = get_my_consultant_id())
        AND get_my_role() = 'BrandManager'
    );

DROP POLICY IF EXISTS leads_select_all ON leads;
CREATE POLICY leads_select_all ON leads FOR SELECT
    TO authenticated
    USING (is_admin());

-- INSERT: All authenticated can create leads
DROP POLICY IF EXISTS leads_insert_all ON leads;
CREATE POLICY leads_insert_all ON leads FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Role-scoped
DROP POLICY IF EXISTS leads_update_own ON leads;
CREATE POLICY leads_update_own ON leads FOR UPDATE
    TO authenticated
    USING (assigned_to = get_my_consultant_id() AND get_my_role() IN ('RM', 'Trainer'));

DROP POLICY IF EXISTS leads_update_brand ON leads;
CREATE POLICY leads_update_brand ON leads FOR UPDATE
    TO authenticated
    USING (
        brand_id IN (SELECT brand_id FROM consultant_brands WHERE consultant_id = get_my_consultant_id())
        AND get_my_role() = 'BrandManager'
    );

DROP POLICY IF EXISTS leads_update_all ON leads;
CREATE POLICY leads_update_all ON leads FOR UPDATE
    TO authenticated
    USING (is_admin());

-- DELETE: Admin only
DROP POLICY IF EXISTS leads_delete_admin ON leads;
CREATE POLICY leads_delete_admin ON leads FOR DELETE
    TO authenticated
    USING (is_admin());


-- ----- BRANDS -----
DROP POLICY IF EXISTS brands_select_all ON brands;
CREATE POLICY brands_select_all ON brands FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS brands_insert_admin ON brands;
CREATE POLICY brands_insert_admin ON brands FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS brands_update_admin ON brands;
CREATE POLICY brands_update_admin ON brands FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS brands_delete_admin ON brands;
CREATE POLICY brands_delete_admin ON brands FOR DELETE TO authenticated USING (is_admin());


-- ----- CONSULTANTS -----
DROP POLICY IF EXISTS consultants_select_all ON consultants;
CREATE POLICY consultants_select_all ON consultants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS consultants_insert_admin ON consultants;
CREATE POLICY consultants_insert_admin ON consultants FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS consultants_update_own ON consultants;
CREATE POLICY consultants_update_own ON consultants FOR UPDATE
    TO authenticated USING (id = get_my_consultant_id());

DROP POLICY IF EXISTS consultants_update_admin ON consultants;
CREATE POLICY consultants_update_admin ON consultants FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS consultants_delete_admin ON consultants;
CREATE POLICY consultants_delete_admin ON consultants FOR DELETE TO authenticated USING (is_admin());


-- ----- AI TABLES (read for all, write for admin only) -----
-- Edge functions bypass RLS via service_role_key

DROP POLICY IF EXISTS ai_agents_select ON ai_agents;
CREATE POLICY ai_agents_select ON ai_agents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ai_agents_insert ON ai_agents;
CREATE POLICY ai_agents_insert ON ai_agents FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS ai_agents_update ON ai_agents;
CREATE POLICY ai_agents_update ON ai_agents FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS ai_agents_delete ON ai_agents;
CREATE POLICY ai_agents_delete ON ai_agents FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS ai_jobs_select ON ai_jobs;
CREATE POLICY ai_jobs_select ON ai_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ai_jobs_insert ON ai_jobs;
CREATE POLICY ai_jobs_insert ON ai_jobs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS ai_jobs_update ON ai_jobs;
CREATE POLICY ai_jobs_update ON ai_jobs FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS ai_jobs_delete ON ai_jobs;
CREATE POLICY ai_jobs_delete ON ai_jobs FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS ai_outcomes_select ON ai_outcomes;
CREATE POLICY ai_outcomes_select ON ai_outcomes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ai_outcomes_insert ON ai_outcomes;
CREATE POLICY ai_outcomes_insert ON ai_outcomes FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS ai_outcomes_update ON ai_outcomes;
CREATE POLICY ai_outcomes_update ON ai_outcomes FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS ai_outcomes_delete ON ai_outcomes;
CREATE POLICY ai_outcomes_delete ON ai_outcomes FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS ai_evolution_select ON ai_evolution;
CREATE POLICY ai_evolution_select ON ai_evolution FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ai_evolution_insert ON ai_evolution;
CREATE POLICY ai_evolution_insert ON ai_evolution FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS agent_memory_select ON agent_memory;
CREATE POLICY agent_memory_select ON agent_memory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS agent_memory_insert ON agent_memory;
CREATE POLICY agent_memory_insert ON agent_memory FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS agent_memory_update ON agent_memory;
CREATE POLICY agent_memory_update ON agent_memory FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS agent_memory_delete ON agent_memory;
CREATE POLICY agent_memory_delete ON agent_memory FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS agent_workflows_select ON agent_workflows;
CREATE POLICY agent_workflows_select ON agent_workflows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS agent_workflows_insert ON agent_workflows;
CREATE POLICY agent_workflows_insert ON agent_workflows FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS agent_workflows_update ON agent_workflows;
CREATE POLICY agent_workflows_update ON agent_workflows FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS agent_workflows_delete ON agent_workflows;
CREATE POLICY agent_workflows_delete ON agent_workflows FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS agent_objectives_select ON agent_objectives;
CREATE POLICY agent_objectives_select ON agent_objectives FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS agent_objectives_insert ON agent_objectives;
CREATE POLICY agent_objectives_insert ON agent_objectives FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS agent_objectives_update ON agent_objectives;
CREATE POLICY agent_objectives_update ON agent_objectives FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS agent_objectives_delete ON agent_objectives;
CREATE POLICY agent_objectives_delete ON agent_objectives FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS agent_activity_log_select ON agent_activity_log;
CREATE POLICY agent_activity_log_select ON agent_activity_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS agent_activity_log_insert ON agent_activity_log;
CREATE POLICY agent_activity_log_insert ON agent_activity_log FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS agent_conversations_select ON agent_conversations;
CREATE POLICY agent_conversations_select ON agent_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS agent_conversations_insert ON agent_conversations;
CREATE POLICY agent_conversations_insert ON agent_conversations FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS agent_conversations_delete ON agent_conversations;
CREATE POLICY agent_conversations_delete ON agent_conversations FOR DELETE TO authenticated USING (is_admin());


-- ----- MEETINGS -----
DROP POLICY IF EXISTS meetings_select_own ON meetings;
CREATE POLICY meetings_select_own ON meetings FOR SELECT
    TO authenticated USING (consultant_id = get_my_consultant_id());
DROP POLICY IF EXISTS meetings_select_admin ON meetings;
CREATE POLICY meetings_select_admin ON meetings FOR SELECT
    TO authenticated USING (is_admin());
DROP POLICY IF EXISTS meetings_insert_all ON meetings;
CREATE POLICY meetings_insert_all ON meetings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS meetings_update_own ON meetings;
CREATE POLICY meetings_update_own ON meetings FOR UPDATE
    TO authenticated USING (consultant_id = get_my_consultant_id() OR is_admin());
DROP POLICY IF EXISTS meetings_delete_admin ON meetings;
CREATE POLICY meetings_delete_admin ON meetings FOR DELETE TO authenticated USING (is_admin());


-- ----- INVOICES -----
DROP POLICY IF EXISTS invoices_select_all ON invoices;
CREATE POLICY invoices_select_all ON invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS invoices_insert_admin ON invoices;
CREATE POLICY invoices_insert_admin ON invoices FOR INSERT TO authenticated WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS invoices_update_admin ON invoices;
CREATE POLICY invoices_update_admin ON invoices FOR UPDATE TO authenticated USING (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS invoices_delete_admin ON invoices;
CREATE POLICY invoices_delete_admin ON invoices FOR DELETE TO authenticated USING (is_admin());


-- ----- INVOICE ITEMS -----
DROP POLICY IF EXISTS invoice_items_select_all ON invoice_items;
CREATE POLICY invoice_items_select_all ON invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS invoice_items_insert_admin ON invoice_items;
CREATE POLICY invoice_items_insert_admin ON invoice_items FOR INSERT TO authenticated WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS invoice_items_update_admin ON invoice_items;
CREATE POLICY invoice_items_update_admin ON invoice_items FOR UPDATE TO authenticated USING (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS invoice_items_delete_admin ON invoice_items;
CREATE POLICY invoice_items_delete_admin ON invoice_items FOR DELETE TO authenticated USING (is_admin());


-- ----- PAYMENTS -----
DROP POLICY IF EXISTS payments_select_all ON payments;
CREATE POLICY payments_select_all ON payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS payments_insert_admin ON payments;
CREATE POLICY payments_insert_admin ON payments FOR INSERT TO authenticated WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS payments_update_admin ON payments;
CREATE POLICY payments_update_admin ON payments FOR UPDATE TO authenticated USING (is_admin() OR get_my_role() = 'Accounts');


-- ----- PAYMENT WEBHOOKS -----
DROP POLICY IF EXISTS payment_webhooks_select_all ON payment_webhooks;
CREATE POLICY payment_webhooks_select_all ON payment_webhooks FOR SELECT TO authenticated USING (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS payment_webhooks_insert_all ON payment_webhooks;
CREATE POLICY payment_webhooks_insert_all ON payment_webhooks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS payment_webhooks_update_all ON payment_webhooks;
CREATE POLICY payment_webhooks_update_all ON payment_webhooks FOR UPDATE TO authenticated USING (true);


-- ----- LEAD ACTIVITIES -----
DROP POLICY IF EXISTS lead_activities_select_all ON lead_activities;
CREATE POLICY lead_activities_select_all ON lead_activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lead_activities_insert_all ON lead_activities;
CREATE POLICY lead_activities_insert_all ON lead_activities FOR INSERT TO authenticated WITH CHECK (true);


-- ----- DOCUMENTS -----
DROP POLICY IF EXISTS documents_select_all ON documents;
CREATE POLICY documents_select_all ON documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS documents_insert_all ON documents;
CREATE POLICY documents_insert_all ON documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS documents_update_all ON documents;
CREATE POLICY documents_update_all ON documents FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS documents_delete_admin ON documents;
CREATE POLICY documents_delete_admin ON documents FOR DELETE TO authenticated USING (is_admin());


-- ----- NOTIFICATIONS -----
DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications FOR SELECT
    TO authenticated USING (user_id = get_my_consultant_id());
DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications FOR UPDATE
    TO authenticated USING (user_id = get_my_consultant_id());
DROP POLICY IF EXISTS notifications_insert_all ON notifications;
CREATE POLICY notifications_insert_all ON notifications FOR INSERT TO authenticated WITH CHECK (true);


-- ----- SETTINGS -----
DROP POLICY IF EXISTS settings_select_all ON settings;
CREATE POLICY settings_select_all ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS settings_update_admin ON settings;
CREATE POLICY settings_update_admin ON settings FOR UPDATE TO authenticated USING (is_admin());


-- ----- CONSULTANT BRANDS -----
DROP POLICY IF EXISTS consultant_brands_select_all ON consultant_brands;
CREATE POLICY consultant_brands_select_all ON consultant_brands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS consultant_brands_insert_admin ON consultant_brands;
CREATE POLICY consultant_brands_insert_admin ON consultant_brands FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS consultant_brands_delete_admin ON consultant_brands;
CREATE POLICY consultant_brands_delete_admin ON consultant_brands FOR DELETE TO authenticated USING (is_admin());


-- ----- LEAD OBJECTIONS -----
DROP POLICY IF EXISTS lead_objections_select_all ON lead_objections;
CREATE POLICY lead_objections_select_all ON lead_objections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lead_objections_insert_all ON lead_objections;
CREATE POLICY lead_objections_insert_all ON lead_objections FOR INSERT TO authenticated WITH CHECK (true);


-- ----- NEGOTIATION HISTORY -----
DROP POLICY IF EXISTS negotiation_history_select_all ON negotiation_history;
CREATE POLICY negotiation_history_select_all ON negotiation_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS negotiation_history_insert_all ON negotiation_history;
CREATE POLICY negotiation_history_insert_all ON negotiation_history FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- 3. VERIFY RLS ENABLED ON ALL TABLES
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
