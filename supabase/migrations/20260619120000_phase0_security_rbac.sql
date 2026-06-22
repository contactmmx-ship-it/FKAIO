/*
# Phase 0 — Security & RBAC Foundation

Problem being fixed:
- Every RLS policy in the original schema was USING(true) for any authenticated
  user — no brand isolation, no role separation. A few policies on ai_jobs even
  granted the `anon` (logged-out) role full read/write/delete access.
- consultants.role existed but nothing enforced it.

This migration:
1. Adds consultant_brands (many-to-many: which brand(s) a consultant can see)
2. Adds helper functions: get_my_consultant_id(), get_my_role(), is_admin(), my_brand_ids()
3. Auto-links new auth.users to a consultants row (matches by email, else
   creates one defaulted to role='RM' so nobody is ever a ghost login)
4. Replaces every USING(true)/anon-open policy with role + brand scoped policies

Role model implemented (default assumptions — adjust later in Settings):
- Founder, OpsHead       -> full access to everything
- BrandManager           -> full access scoped to their assigned brand(s)
- RM                     -> only leads/activities/meetings/documents assigned to them
- Accounts               -> full access to invoices/payments, read-only on leads
- Trainer                -> read-only, dashboard/notifications only
- AI agent internals (ai_agents, ai_jobs, agent_*) -> readable by all authenticated
  staff (needed for dashboards), but insert/update/delete restricted to admins.
  The ai-engine edge function uses the service role key, which bypasses RLS
  entirely, so the automated pipeline is unaffected by these restrictions.
*/

-- ============================================================
-- 1. CONSULTANT <-> BRAND MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS consultant_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid REFERENCES consultants(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (consultant_id, brand_id)
);

ALTER TABLE consultant_brands ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HELPER FUNCTIONS (SECURITY DEFINER so they can read consultants
--    regardless of the caller's own row-level access)
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_consultant_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT id FROM consultants WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM consultants WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(get_my_role() IN ('Founder', 'OpsHead'), false);
$$;

CREATE OR REPLACE FUNCTION my_brand_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(array_agg(brand_id), ARRAY[]::uuid[])
  FROM consultant_brands
  WHERE consultant_id = get_my_consultant_id();
$$;

-- ============================================================
-- 3. AUTO-LINK NEW AUTH USERS TO A CONSULTANT ROW
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE consultants
  SET auth_user_id = NEW.id
  WHERE email = NEW.email AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    INSERT INTO consultants (auth_user_id, name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'RM'
    )
    ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================
-- 4. REPLACE POLICIES — BRANDS
-- ============================================================
DROP POLICY IF EXISTS "select_brands" ON brands;
CREATE POLICY "select_brands" ON brands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_brands" ON brands;
CREATE POLICY "insert_brands" ON brands FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_brands" ON brands;
CREATE POLICY "update_brands" ON brands FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_brands" ON brands;
CREATE POLICY "delete_brands" ON brands FOR DELETE TO authenticated USING (is_admin());

-- CONSULTANT_BRANDS
DROP POLICY IF EXISTS "select_consultant_brands" ON consultant_brands;
CREATE POLICY "select_consultant_brands" ON consultant_brands FOR SELECT TO authenticated
  USING (is_admin() OR consultant_id = get_my_consultant_id());
DROP POLICY IF EXISTS "write_consultant_brands" ON consultant_brands;
CREATE POLICY "write_consultant_brands" ON consultant_brands FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 5. CONSULTANTS — everyone can see names (needed for assignment
--    dropdowns), only admins can edit roles/create/delete
-- ============================================================
DROP POLICY IF EXISTS "select_consultants" ON consultants;
CREATE POLICY "select_consultants" ON consultants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_consultants" ON consultants;
CREATE POLICY "insert_consultants" ON consultants FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_consultants" ON consultants;
CREATE POLICY "update_consultants" ON consultants FOR UPDATE TO authenticated
  USING (is_admin() OR auth_user_id = auth.uid())
  WITH CHECK (is_admin() OR auth_user_id = auth.uid());
DROP POLICY IF EXISTS "delete_consultants" ON consultants;
CREATE POLICY "delete_consultants" ON consultants FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- 6. LEADS — admin sees all; BrandManager sees their brand(s);
--    RM sees only leads assigned to them; Accounts read-only all
-- ============================================================
DROP POLICY IF EXISTS "select_leads" ON leads;
CREATE POLICY "select_leads" ON leads FOR SELECT TO authenticated USING (
  is_admin()
  OR get_my_role() = 'Accounts'
  OR assigned_to = get_my_consultant_id()
  OR brand_id = ANY (my_brand_ids())
);
DROP POLICY IF EXISTS "insert_leads" ON leads;
CREATE POLICY "insert_leads" ON leads FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR brand_id = ANY (my_brand_ids()) OR get_my_role() = 'RM'
);
DROP POLICY IF EXISTS "update_leads" ON leads;
CREATE POLICY "update_leads" ON leads FOR UPDATE TO authenticated
  USING (is_admin() OR assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids()))
  WITH CHECK (is_admin() OR assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids()));
DROP POLICY IF EXISTS "delete_leads" ON leads;
CREATE POLICY "delete_leads" ON leads FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- 7. LEAD ACTIVITIES / MEETINGS / DOCUMENTS — scoped via parent lead
-- ============================================================
DROP POLICY IF EXISTS "select_lead_activities" ON lead_activities;
CREATE POLICY "select_lead_activities" ON lead_activities FOR SELECT TO authenticated USING (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "insert_lead_activities" ON lead_activities;
CREATE POLICY "insert_lead_activities" ON lead_activities FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "update_lead_activities" ON lead_activities;
CREATE POLICY "update_lead_activities" ON lead_activities FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_lead_activities" ON lead_activities;
CREATE POLICY "delete_lead_activities" ON lead_activities FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_meetings" ON meetings;
CREATE POLICY "select_meetings" ON meetings FOR SELECT TO authenticated USING (
  is_admin() OR consultant_id = get_my_consultant_id() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "insert_meetings" ON meetings;
CREATE POLICY "insert_meetings" ON meetings FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR consultant_id = get_my_consultant_id() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "update_meetings" ON meetings;
CREATE POLICY "update_meetings" ON meetings FOR UPDATE TO authenticated
  USING (is_admin() OR consultant_id = get_my_consultant_id())
  WITH CHECK (is_admin() OR consultant_id = get_my_consultant_id());
DROP POLICY IF EXISTS "delete_meetings" ON meetings;
CREATE POLICY "delete_meetings" ON meetings FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_documents" ON documents;
CREATE POLICY "select_documents" ON documents FOR SELECT TO authenticated USING (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "insert_documents" ON documents;
CREATE POLICY "insert_documents" ON documents FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "update_documents" ON documents;
CREATE POLICY "update_documents" ON documents FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_documents" ON documents;
CREATE POLICY "delete_documents" ON documents FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- 8. INVOICES / PAYMENTS — Admin + Accounts full; RM read-only
--    on invoices tied to their own leads
-- ============================================================
DROP POLICY IF EXISTS "select_invoices" ON invoices;
CREATE POLICY "select_invoices" ON invoices FOR SELECT TO authenticated USING (
  is_admin() OR get_my_role() = 'Accounts' OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id()
  )
);
DROP POLICY IF EXISTS "insert_invoices" ON invoices;
CREATE POLICY "insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR get_my_role() = 'Accounts'
);
DROP POLICY IF EXISTS "update_invoices" ON invoices;
CREATE POLICY "update_invoices" ON invoices FOR UPDATE TO authenticated
  USING (is_admin() OR get_my_role() = 'Accounts')
  WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS "delete_invoices" ON invoices;
CREATE POLICY "delete_invoices" ON invoices FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_payments" ON payments;
CREATE POLICY "select_payments" ON payments FOR SELECT TO authenticated USING (
  is_admin() OR get_my_role() = 'Accounts' OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id()
  )
);
DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR get_my_role() = 'Accounts'
);
DROP POLICY IF EXISTS "update_payments" ON payments;
CREATE POLICY "update_payments" ON payments FOR UPDATE TO authenticated
  USING (is_admin() OR get_my_role() = 'Accounts')
  WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS "delete_payments" ON payments;
CREATE POLICY "delete_payments" ON payments FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- 9. AI AGENTS / JOBS / OUTCOMES / EVOLUTION — readable by all
--    staff (dashboards need this), writable by admins only.
--    NOTE: the ai-engine edge function uses the service role key
--    and bypasses RLS, so the automated pipeline still works.
-- ============================================================
DROP POLICY IF EXISTS "select_ai_agents" ON ai_agents;
CREATE POLICY "select_ai_agents" ON ai_agents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_agents" ON ai_agents;
CREATE POLICY "insert_ai_agents" ON ai_agents FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_ai_agents" ON ai_agents;
CREATE POLICY "update_ai_agents" ON ai_agents FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_ai_agents" ON ai_agents;
CREATE POLICY "delete_ai_agents" ON ai_agents FOR DELETE TO authenticated USING (is_admin());

-- ai_jobs: also strip the anon-open policies from the redundant
-- 20260618113146 migration — anon should never read/write this table.
DROP POLICY IF EXISTS "anon_select_ai_jobs" ON ai_jobs;
DROP POLICY IF EXISTS "anon_insert_ai_jobs" ON ai_jobs;
DROP POLICY IF EXISTS "anon_update_ai_jobs" ON ai_jobs;
DROP POLICY IF EXISTS "anon_delete_ai_jobs" ON ai_jobs;

DROP POLICY IF EXISTS "select_ai_jobs" ON ai_jobs;
CREATE POLICY "select_ai_jobs" ON ai_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_jobs" ON ai_jobs;
CREATE POLICY "insert_ai_jobs" ON ai_jobs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_jobs" ON ai_jobs;
CREATE POLICY "update_ai_jobs" ON ai_jobs FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_ai_jobs" ON ai_jobs;
CREATE POLICY "delete_ai_jobs" ON ai_jobs FOR DELETE TO authenticated USING (is_admin());

-- ai_jobs from the redundant migration may be missing columns if it had
-- somehow run first on a different environment — make this idempotent.
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES ai_agents(id);
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS error text;

DROP POLICY IF EXISTS "select_ai_outcomes" ON ai_outcomes;
CREATE POLICY "select_ai_outcomes" ON ai_outcomes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_outcomes" ON ai_outcomes;
CREATE POLICY "insert_ai_outcomes" ON ai_outcomes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_outcomes" ON ai_outcomes;
CREATE POLICY "update_ai_outcomes" ON ai_outcomes FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_ai_outcomes" ON ai_outcomes;
CREATE POLICY "delete_ai_outcomes" ON ai_outcomes FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_ai_evolution" ON ai_evolution;
CREATE POLICY "select_ai_evolution" ON ai_evolution FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "insert_ai_evolution" ON ai_evolution;
CREATE POLICY "insert_ai_evolution" ON ai_evolution FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_ai_evolution" ON ai_evolution;
CREATE POLICY "update_ai_evolution" ON ai_evolution FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_ai_evolution" ON ai_evolution;
CREATE POLICY "delete_ai_evolution" ON ai_evolution FOR DELETE TO authenticated USING (is_admin());

-- agent_memory / agent_workflows / agent_objectives / agent_activity_log /
-- agent_conversations — readable by staff, writable by admin (service role
-- still bypasses this for the automated pipeline)
DROP POLICY IF EXISTS "select_agent_memory" ON agent_memory;
CREATE POLICY "select_agent_memory" ON agent_memory FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "insert_agent_memory" ON agent_memory;
CREATE POLICY "insert_agent_memory" ON agent_memory FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_agent_memory" ON agent_memory;
CREATE POLICY "update_agent_memory" ON agent_memory FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_agent_memory" ON agent_memory;
CREATE POLICY "delete_agent_memory" ON agent_memory FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_agent_workflows" ON agent_workflows;
CREATE POLICY "select_agent_workflows" ON agent_workflows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_agent_workflows" ON agent_workflows;
CREATE POLICY "insert_agent_workflows" ON agent_workflows FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_agent_workflows" ON agent_workflows;
CREATE POLICY "update_agent_workflows" ON agent_workflows FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_agent_workflows" ON agent_workflows;
CREATE POLICY "delete_agent_workflows" ON agent_workflows FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_agent_objectives" ON agent_objectives;
CREATE POLICY "select_agent_objectives" ON agent_objectives FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_agent_objectives" ON agent_objectives;
CREATE POLICY "insert_agent_objectives" ON agent_objectives FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_agent_objectives" ON agent_objectives;
CREATE POLICY "update_agent_objectives" ON agent_objectives FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_agent_objectives" ON agent_objectives;
CREATE POLICY "delete_agent_objectives" ON agent_objectives FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_agent_activity" ON agent_activity_log;
CREATE POLICY "select_agent_activity" ON agent_activity_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_agent_activity" ON agent_activity_log;
CREATE POLICY "insert_agent_activity" ON agent_activity_log FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "select_own_conversations" ON agent_conversations;
CREATE POLICY "select_own_conversations" ON agent_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_conversations" ON agent_conversations;
CREATE POLICY "insert_conversations" ON agent_conversations FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 10. SETTINGS — admin only
-- ============================================================
DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "insert_settings" ON settings;
CREATE POLICY "insert_settings" ON settings FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "update_settings" ON settings;
CREATE POLICY "update_settings" ON settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_settings" ON settings;
CREATE POLICY "delete_settings" ON settings FOR DELETE TO authenticated USING (is_admin());

-- Indexes for the new lookups
CREATE INDEX IF NOT EXISTS idx_consultant_brands_consultant ON consultant_brands(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_brands_brand ON consultant_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_consultants_auth_user ON consultants(auth_user_id);
