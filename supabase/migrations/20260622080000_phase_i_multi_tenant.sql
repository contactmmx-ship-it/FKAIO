-- ============================================================================
-- Migration: Phase I — Multi-Tenant SaaS Scaffolding
-- Description: Technical infrastructure for multi-tenancy — tenant registry,
--              membership junction, usage metering, subscription event sink,
--              tenant_id columns on existing tables, RLS policies, indexes,
--              and Franchise Kart seed row.
--
-- BUSINESS DECISIONS (founder actions — NOT fabricated here):
--   • Pricing tiers, feature gating per plan, ToS, SLA terms
--   • Trial duration defaults, grace-period policies
--   • Razorpay webhook verification secret (set in Edge Function env)
--   • Branding / white-label configuration
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TENANTS — Top-level tenant / organization registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_name         TEXT NOT NULL,
    tenant_slug         TEXT UNIQUE NOT NULL,
    owner_id            UUID REFERENCES public.consultants(id) ON DELETE CASCADE,
    plan                TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free','starter','growth','enterprise','custom')),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trial','active','suspended','cancelled')),
    trial_ends_at       TIMESTAMPTZ,
    subscription_id     TEXT,                          -- Razorpay subscription ID
    max_consultants     INTEGER NOT NULL DEFAULT 5,
    max_brands          INTEGER NOT NULL DEFAULT 3,
    max_leads           INTEGER NOT NULL DEFAULT 500,
    max_ai_jobs_monthly INTEGER NOT NULL DEFAULT 100,
    features            JSONB NOT NULL DEFAULT '{}',   -- feature flags per plan
    settings            JSONB NOT NULL DEFAULT '{}',   -- tenant-level settings
    billing_email       TEXT,
    billing_name        TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. TENANT_CONSULTANTS — Junction: which consultants belong to which tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_consultants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    consultant_id   UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','member','viewer')),
    invited_by      UUID REFERENCES public.consultants(id),
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at       TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('invited','active','suspended','removed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, consultant_id)
);

ALTER TABLE public.tenant_consultants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. TENANT_USAGE — Monthly usage tracking for billing enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    consultant_count INTEGER NOT NULL DEFAULT 0,
    brand_count     INTEGER NOT NULL DEFAULT 0,
    lead_count      INTEGER NOT NULL DEFAULT 0,
    ai_job_count    INTEGER NOT NULL DEFAULT 0,
    ai_tokens_used  INTEGER NOT NULL DEFAULT 0,
    ai_cost_usd     NUMERIC(10,4) NOT NULL DEFAULT 0,
    storage_mb      NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, period_start)
);

ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. SUBSCRIPTION_EVENTS — Razorpay webhook event sink
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type          TEXT NOT NULL,                -- e.g. subscription.activated, payment.failed
    razorpay_event_id   TEXT UNIQUE,
    payload             JSONB NOT NULL,
    processed           BOOLEAN NOT NULL DEFAULT false,
    processed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 5. TENANT-AWARE HELPER FUNCTIONS
--    (Leverage existing get_my_consultant_id() / is_admin() from Phase 0)
-- ============================================================================

-- Returns all tenant IDs the current authenticated consultant belongs to
CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT COALESCE(array_agg(tc.tenant_id), ARRAY[]::uuid[])
    FROM public.tenant_consultants tc
    WHERE tc.consultant_id = public.get_my_consultant_id()
      AND tc.status = 'active';
$$;

-- Returns the consultant's role within a specific tenant (NULL if not a member)
CREATE OR REPLACE FUNCTION public.my_tenant_role(p_tenant_id uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT tc.role
    FROM public.tenant_consultants tc
    WHERE tc.tenant_id = p_tenant_id
      AND tc.consultant_id = public.get_my_consultant_id()
      AND tc.status = 'active'
    LIMIT 1;
$$;

-- Returns true if the current user is an active member of the given tenant
CREATE OR REPLACE FUNCTION public.belongs_to_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_consultants tc
        WHERE tc.tenant_id = p_tenant_id
          AND tc.consultant_id = public.get_my_consultant_id()
          AND tc.status = 'active'
    );
$$;

-- Returns true if the current user is owner or admin within the given tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_consultants tc
        WHERE tc.tenant_id = p_tenant_id
          AND tc.consultant_id = public.get_my_consultant_id()
          AND tc.status = 'active'
          AND tc.role IN ('owner', 'admin')
    );
$$;

COMMENT ON FUNCTION public.my_tenant_ids()      IS 'Returns UUID[] of tenants the current consultant is an active member of.';
COMMENT ON FUNCTION public.my_tenant_role()     IS 'Returns the consultant role within a specific tenant, or NULL.';
COMMENT ON FUNCTION public.belongs_to_tenant()  IS 'True if current user is an active member of the given tenant.';
COMMENT ON FUNCTION public.is_tenant_admin()    IS 'True if current user is owner or admin within the given tenant.';


-- ============================================================================
-- 6. RLS POLICIES — New tenant tables
-- ============================================================================

-- ── tenants ──────────────────────────────────────────────────────────────────
-- SELECT: platform admin (Founder/OpsHead) sees all; tenant owner sees own
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select"
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR owner_id = public.get_my_consultant_id()
    );

-- INSERT: authenticated users can create tenants (application layer gates plan/status)
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
CREATE POLICY "tenants_insert"
    ON public.tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: platform admin or tenant owner/admin can update
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
CREATE POLICY "tenants_update"
    ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR owner_id = public.get_my_consultant_id()
    )
    WITH CHECK (
        public.is_admin()
        OR owner_id = public.get_my_consultant_id()
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;
CREATE POLICY "tenants_delete"
    ON public.tenants
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ── tenant_consultants ───────────────────────────────────────────────────────
-- SELECT: platform admin sees all; members see their own tenant's roster
DROP POLICY IF EXISTS "tenant_consultants_select" ON public.tenant_consultants;
CREATE POLICY "tenant_consultants_select"
    ON public.tenant_consultants
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR public.belongs_to_tenant(tenant_id)
    );

-- INSERT: authenticated can add members (application enforces role/invite logic)
DROP POLICY IF EXISTS "tenant_consultants_insert" ON public.tenant_consultants;
CREATE POLICY "tenant_consultants_insert"
    ON public.tenant_consultants
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: platform admin or tenant owner/admin
DROP POLICY IF EXISTS "tenant_consultants_update" ON public.tenant_consultants;
CREATE POLICY "tenant_consultants_update"
    ON public.tenant_consultants
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    );

-- DELETE: platform admin or tenant owner/admin
DROP POLICY IF EXISTS "tenant_consultants_delete" ON public.tenant_consultants;
CREATE POLICY "tenant_consultants_delete"
    ON public.tenant_consultants
    FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    );


-- ── tenant_usage ────────────────────────────────────────────────────────────
-- SELECT: platform admin or tenant owner/admin (billing-sensitive)
DROP POLICY IF EXISTS "tenant_usage_select" ON public.tenant_usage;
CREATE POLICY "tenant_usage_select"
    ON public.tenant_usage
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    );

-- INSERT: service_role only (automated metering jobs use service_role key)
DROP POLICY IF EXISTS "tenant_usage_insert" ON public.tenant_usage;
CREATE POLICY "tenant_usage_insert"
    ON public.tenant_usage
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- UPDATE: service_role only
DROP POLICY IF EXISTS "tenant_usage_update" ON public.tenant_usage;
CREATE POLICY "tenant_usage_update"
    ON public.tenant_usage
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- DELETE: platform admin only
DROP POLICY IF EXISTS "tenant_usage_delete" ON public.tenant_usage;
CREATE POLICY "tenant_usage_delete"
    ON public.tenant_usage
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ── subscription_events ──────────────────────────────────────────────────────
-- SELECT: platform admin or tenant owner/admin
DROP POLICY IF EXISTS "subscription_events_select" ON public.subscription_events;
CREATE POLICY "subscription_events_select"
    ON public.subscription_events
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    );

-- INSERT: authenticated (Razorpay webhook edge function uses service_role which
--         bypasses RLS, but admin can also manually record events)
DROP POLICY IF EXISTS "subscription_events_insert" ON public.subscription_events;
CREATE POLICY "subscription_events_insert"
    ON public.subscription_events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: platform admin or tenant owner/admin (for reprocessing failed events)
DROP POLICY IF EXISTS "subscription_events_update" ON public.subscription_events;
CREATE POLICY "subscription_events_update"
    ON public.subscription_events
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_tenant_admin(tenant_id)
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "subscription_events_delete" ON public.subscription_events;
CREATE POLICY "subscription_events_delete"
    ON public.subscription_events
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ============================================================================
-- 7. ADD tenant_id TO EXISTING TABLES (additive, non-destructive, nullable)
-- ============================================================================
ALTER TABLE public.brands      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.leads       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.invoices    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.meetings    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;


-- ============================================================================
-- 8. RLS POLICIES — Existing tables (replaced with tenant-aware versions)
--    Logic: if tenant_id IS NULL → legacy access (backward compat)
--           if tenant_id IS NOT NULL → must belong to that tenant (or be admin)
--    NOTE: service_role key bypasses all RLS — automated pipelines unaffected.
-- ============================================================================

-- ── brands ───────────────────────────────────────────────────────────────────
-- SELECT: admin all; tenant members see own tenant's brands; legacy rows visible to all
DROP POLICY IF EXISTS "select_brands" ON public.brands;
CREATE POLICY "select_brands"
    ON public.brands
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR tenant_id IS NULL
        OR public.belongs_to_tenant(tenant_id)
    );

-- INSERT: admin or tenant admin can create brands within their tenant
DROP POLICY IF EXISTS "insert_brands" ON public.brands;
CREATE POLICY "insert_brands"
    ON public.brands
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR tenant_id IS NULL
        OR public.is_tenant_admin(tenant_id)
    );

-- UPDATE: admin or tenant admin
DROP POLICY IF EXISTS "update_brands" ON public.brands;
CREATE POLICY "update_brands"
    ON public.brands
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR tenant_id IS NULL
        OR public.is_tenant_admin(tenant_id)
    )
    WITH CHECK (
        public.is_admin()
        OR tenant_id IS NULL
        OR public.is_tenant_admin(tenant_id)
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "delete_brands" ON public.brands;
CREATE POLICY "delete_brands"
    ON public.brands
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ── leads ────────────────────────────────────────────────────────────────────
-- SELECT: tenant-scoped with legacy fallback
DROP POLICY IF EXISTS "select_leads" ON public.leads;
CREATE POLICY "select_leads"
    ON public.leads
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND (
                public.get_my_role() = 'Accounts'
                OR assigned_to = public.get_my_consultant_id()
                OR brand_id = ANY (public.my_brand_ids())
            )
        )
    );

-- INSERT: tenant-scoped with legacy fallback
DROP POLICY IF EXISTS "insert_leads" ON public.leads;
CREATE POLICY "insert_leads"
    ON public.leads
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND (
                brand_id = ANY (public.my_brand_ids())
                OR public.get_my_role() = 'RM'
            )
        )
    );

-- UPDATE: same scoping as SELECT
DROP POLICY IF EXISTS "update_leads" ON public.leads;
CREATE POLICY "update_leads"
    ON public.leads
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND (
                assigned_to = public.get_my_consultant_id()
                OR brand_id = ANY (public.my_brand_ids())
            )
        )
    )
    WITH CHECK (
        public.is_admin()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND (
                assigned_to = public.get_my_consultant_id()
                OR brand_id = ANY (public.my_brand_ids())
            )
        )
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "delete_leads" ON public.leads;
CREATE POLICY "delete_leads"
    ON public.leads
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ── consultants ──────────────────────────────────────────────────────────────
-- SELECT: admin sees all; tenant members see own tenant's consultants; legacy all
DROP POLICY IF EXISTS "select_consultants" ON public.consultants;
CREATE POLICY "select_consultants"
    ON public.consultants
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR tenant_id IS NULL
        OR public.belongs_to_tenant(tenant_id)
    );

-- INSERT: platform admin only (consultant provisioning is privileged)
DROP POLICY IF EXISTS "insert_consultants" ON public.consultants;
CREATE POLICY "insert_consultants"
    ON public.consultants
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- UPDATE: admin all; own profile; or tenant admin for their tenant's consultants
DROP POLICY IF EXISTS "update_consultants" ON public.consultants;
CREATE POLICY "update_consultants"
    ON public.consultants
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR auth_user_id = auth.uid()
        OR (
            tenant_id IS NOT NULL
            AND public.is_tenant_admin(tenant_id)
        )
    )
    WITH CHECK (
        public.is_admin()
        OR auth_user_id = auth.uid()
        OR (
            tenant_id IS NOT NULL
            AND public.is_tenant_admin(tenant_id)
        )
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "delete_consultants" ON public.consultants;
CREATE POLICY "delete_consultants"
    ON public.consultants
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ── invoices ─────────────────────────────────────────────────────────────────
-- SELECT: tenant-scoped with legacy fallback; Accounts role preserved
DROP POLICY IF EXISTS "select_invoices" ON public.invoices;
CREATE POLICY "select_invoices"
    ON public.invoices
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR public.get_my_role() = 'Accounts'
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND lead_id IN (
                SELECT id FROM public.leads WHERE assigned_to = public.get_my_consultant_id()
            )
        )
    );

-- INSERT: admin or Accounts or tenant member
DROP POLICY IF EXISTS "insert_invoices" ON public.invoices;
CREATE POLICY "insert_invoices"
    ON public.invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR public.get_my_role() = 'Accounts'
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
    );

-- UPDATE: admin or Accounts or tenant member
DROP POLICY IF EXISTS "update_invoices" ON public.invoices;
CREATE POLICY "update_invoices"
    ON public.invoices
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR public.get_my_role() = 'Accounts'
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
    )
    WITH CHECK (
        public.is_admin()
        OR public.get_my_role() = 'Accounts'
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "delete_invoices" ON public.invoices;
CREATE POLICY "delete_invoices"
    ON public.invoices
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ── meetings ─────────────────────────────────────────────────────────────────
-- SELECT: tenant-scoped with legacy fallback
DROP POLICY IF EXISTS "select_meetings" ON public.meetings;
CREATE POLICY "select_meetings"
    ON public.meetings
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND (
                consultant_id = public.get_my_consultant_id()
                OR lead_id IN (
                    SELECT id FROM public.leads
                    WHERE assigned_to = public.get_my_consultant_id()
                       OR brand_id = ANY (public.my_brand_ids())
                )
            )
        )
    );

-- INSERT: tenant-scoped with legacy fallback
DROP POLICY IF EXISTS "insert_meetings" ON public.meetings;
CREATE POLICY "insert_meetings"
    ON public.meetings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
        OR (
            tenant_id IS NULL
            AND (
                consultant_id = public.get_my_consultant_id()
                OR lead_id IN (
                    SELECT id FROM public.leads
                    WHERE assigned_to = public.get_my_consultant_id()
                       OR brand_id = ANY (public.my_brand_ids())
                )
            )
        )
    );

-- UPDATE: admin or own meetings
DROP POLICY IF EXISTS "update_meetings" ON public.meetings;
CREATE POLICY "update_meetings"
    ON public.meetings
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR consultant_id = public.get_my_consultant_id()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
    )
    WITH CHECK (
        public.is_admin()
        OR consultant_id = public.get_my_consultant_id()
        OR (
            tenant_id IS NOT NULL
            AND public.belongs_to_tenant(tenant_id)
        )
    );

-- DELETE: platform admin only
DROP POLICY IF EXISTS "delete_meetings" ON public.meetings;
CREATE POLICY "delete_meetings"
    ON public.meetings
    FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ============================================================================
-- 9. INDEXES
-- ============================================================================
-- tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug       ON public.tenants(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id   ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status     ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan        ON public.tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at  ON public.tenants(created_at DESC);

-- tenant_consultants
CREATE INDEX IF NOT EXISTS idx_tenant_consultants_tenant_id     ON public.tenant_consultants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_consultants_consultant_id ON public.tenant_consultants(consultant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_consultants_status        ON public.tenant_consultants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_consultants_role          ON public.tenant_consultants(role);
CREATE INDEX IF NOT EXISTS idx_tenant_consultants_tenant_role   ON public.tenant_consultants(tenant_id, role);

-- tenant_usage
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_period ON public.tenant_usage(tenant_id, period_start);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_period_end    ON public.tenant_usage(period_end);

-- subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_id  ON public.subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type       ON public.subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_razorpay   ON public.subscription_events(razorpay_event_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_processed  ON public.subscription_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_subscription_events_created    ON public.subscription_events(created_at DESC);

-- tenant_id columns on existing tables
CREATE INDEX IF NOT EXISTS idx_brands_tenant_id      ON public.brands(tenant_id)      WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id       ON public.leads(tenant_id)       WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultants_tenant_id ON public.consultants(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id    ON public.invoices(tenant_id)    WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_tenant_id    ON public.meetings(tenant_id)    WHERE tenant_id IS NOT NULL;


-- ============================================================================
-- 10. TRIGGERS — auto-update updated_at
-- ============================================================================
CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tenant_consultants_updated_at
    BEFORE UPDATE ON public.tenant_consultants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tenant_usage_updated_at
    BEFORE UPDATE ON public.tenant_usage
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- 11. SEED — Franchise Kart as the first tenant
--     owner_id is NULL; will be set in a data-migration step when the
--     founder's consultant row is identified.
-- ============================================================================
INSERT INTO public.tenants (
    id, tenant_name, tenant_slug, owner_id, plan, status,
    max_consultants, max_brands, max_leads, max_ai_jobs_monthly
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Franchise Kart',
    'franchise-kart',
    NULL,
    'enterprise',
    'active',
    100,
    50,
    100000,
    10000
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 12. COMMENTS (documentation via psql \d+)
-- ============================================================================
COMMENT ON TABLE public.tenants              IS 'Multi-tenant organization registry. Each tenant is an isolated SaaS customer.';
COMMENT ON TABLE public.tenant_consultants   IS 'Junction table mapping consultants to tenants with role and invitation tracking.';
COMMENT ON TABLE public.tenant_usage         IS 'Monthly usage counters per tenant for billing enforcement and rate limiting.';
COMMENT ON TABLE public.subscription_events  IS 'Razorpay webhook event log for idempotent subscription lifecycle processing.';

COMMENT ON COLUMN public.tenants.subscription_id     IS 'Razorpay subscription ID — set by webhook, not manually.';
COMMENT ON COLUMN public.tenants.features            IS 'JSON feature-flag map per plan. Keys are feature names, values are booleans or config objects.';
COMMENT ON COLUMN public.tenants.max_ai_jobs_monthly IS 'Monthly AI job quota — enforced by application layer, metered in tenant_usage.';

COMMENT ON COLUMN public.tenant_consultants.role     IS 'Per-tenant role: owner, admin, member, viewer. Distinct from consultants.role (platform role).';
COMMENT ON COLUMN public.tenant_consultants.invited_by IS 'UUID of the consultant who sent the invitation.';
COMMENT ON COLUMN public.tenant_consultants.joined_at  IS 'Timestamp when the invite was accepted. NULL until accepted.';

COMMENT ON COLUMN public.tenant_usage.ai_cost_usd    IS 'Estimated AI spend in USD for the billing period.';
COMMENT ON COLUMN public.tenant_usage.storage_mb      IS 'Total storage consumed in megabytes.';

COMMENT ON COLUMN public.subscription_events.razorpay_event_id IS 'Unique Razorpay event identifier for idempotent processing.';
COMMENT ON COLUMN public.subscription_events.processed         IS 'True if the event has been successfully processed by the subscription handler.';

COMMIT;
