-- Phase 3 Fix: Add missing RLS policies for Phase 2/3 tables
-- These tables had RLS enabled but NO policies, making them completely inaccessible.
-- Tables: invoice_items, payment_webhooks, lead_objections, negotiation_history
-- Follows the same role+brand scoped pattern from Phase 0 security_rbac migration.

-- ============================================================
-- invoice_items — Admin + Accounts full; RM read-only on own leads
-- ============================================================
DROP POLICY IF EXISTS "select_invoice_items" ON invoice_items;
CREATE POLICY "select_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (
  is_admin() OR get_my_role() = 'Accounts' OR invoice_id IN (
    SELECT id FROM invoices WHERE lead_id IN (
      SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
    )
  )
);
DROP POLICY IF EXISTS "insert_invoice_items" ON invoice_items;
CREATE POLICY "insert_invoice_items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR get_my_role() = 'Accounts'
);
DROP POLICY IF EXISTS "update_invoice_items" ON invoice_items;
CREATE POLICY "update_invoice_items" ON invoice_items FOR UPDATE TO authenticated
  USING (is_admin() OR get_my_role() = 'Accounts')
  WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS "delete_invoice_items" ON invoice_items;
CREATE POLICY "delete_invoice_items" ON invoice_items FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- payment_webhooks — Admin + Accounts full access (service role
-- also bypasses RLS for automated webhook processing)
-- ============================================================
DROP POLICY IF EXISTS "select_payment_webhooks" ON payment_webhooks;
CREATE POLICY "select_payment_webhooks" ON payment_webhooks FOR SELECT TO authenticated USING (
  is_admin() OR get_my_role() = 'Accounts'
);
DROP POLICY IF EXISTS "insert_payment_webhooks" ON payment_webhooks;
CREATE POLICY "insert_payment_webhooks" ON payment_webhooks FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR get_my_role() = 'Accounts'
);
DROP POLICY IF EXISTS "update_payment_webhooks" ON payment_webhooks;
CREATE POLICY "update_payment_webhooks" ON payment_webhooks FOR UPDATE TO authenticated
  USING (is_admin() OR get_my_role() = 'Accounts')
  WITH CHECK (is_admin() OR get_my_role() = 'Accounts');
DROP POLICY IF EXISTS "delete_payment_webhooks" ON payment_webhooks;
CREATE POLICY "delete_payment_webhooks" ON payment_webhooks FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- lead_objections — scoped via parent lead
-- ============================================================
DROP POLICY IF EXISTS "select_lead_objections" ON lead_objections;
CREATE POLICY "select_lead_objections" ON lead_objections FOR SELECT TO authenticated USING (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "insert_lead_objections" ON lead_objections;
CREATE POLICY "insert_lead_objections" ON lead_objections FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "update_lead_objections" ON lead_objections;
CREATE POLICY "update_lead_objections" ON lead_objections FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_lead_objections" ON lead_objections;
CREATE POLICY "delete_lead_objections" ON lead_objections FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- negotiation_history — scoped via parent lead
-- ============================================================
DROP POLICY IF EXISTS "select_negotiation_history" ON negotiation_history;
CREATE POLICY "select_negotiation_history" ON negotiation_history FOR SELECT TO authenticated USING (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "insert_negotiation_history" ON negotiation_history;
CREATE POLICY "insert_negotiation_history" ON negotiation_history FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR lead_id IN (
    SELECT id FROM leads WHERE assigned_to = get_my_consultant_id() OR brand_id = ANY (my_brand_ids())
  )
);
DROP POLICY IF EXISTS "update_negotiation_history" ON negotiation_history;
CREATE POLICY "update_negotiation_history" ON negotiation_history FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "delete_negotiation_history" ON negotiation_history;
CREATE POLICY "delete_negotiation_history" ON negotiation_history FOR DELETE TO authenticated USING (is_admin());