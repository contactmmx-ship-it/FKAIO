-- ============================================================================
-- Migration: Phase G — Founder Executive AI & Customer-Facing AI
-- Description: Strategic milestones, founder memory, executive briefs tables
--              with RLS policies and seed data for Arofur and Franchisee Kart.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. strategic_milestones — Strategic goals migrated from Chairman Partner OS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategic_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    milestone_type  TEXT CHECK (milestone_type IN ('revenue', 'expansion', 'product', 'team', 'partnership', 'operational')),
    target_value    NUMERIC(12,2),
    current_value   NUMERIC(12,2) DEFAULT 0,
    unit            TEXT,                                      -- e.g. 'INR', 'count', 'percentage'
    baseline_date   DATE,
    target_date     DATE,
    status          TEXT DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'completed', 'cancelled')),
    brand_id        UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    progress_notes  TEXT,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.strategic_milestones ENABLE ROW LEVEL SECURITY;

-- Founder / OpsHead can see all milestones across every brand
CREATE POLICY "strategic_milestones_select_exec"
    ON public.strategic_milestones
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
        OR brand_id = ANY (public.my_brand_ids())
    );

-- Founder / OpsHead can insert milestones for any brand
CREATE POLICY "strategic_milestones_insert_exec"
    ON public.strategic_milestones
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
    );

-- Founder / OpsHead can update any milestone
CREATE POLICY "strategic_milestones_update_exec"
    ON public.strategic_milestones
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
    );

-- Founder / OpsHead can delete any milestone
CREATE POLICY "strategic_milestones_delete_exec"
    ON public.strategic_milestones
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_strategic_milestones_brand_id       ON public.strategic_milestones(brand_id);
CREATE INDEX IF NOT EXISTS idx_strategic_milestones_milestone_type ON public.strategic_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_strategic_milestones_status         ON public.strategic_milestones(status);
CREATE INDEX IF NOT EXISTS idx_strategic_milestones_target_date   ON public.strategic_milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_strategic_milestones_created_by     ON public.strategic_milestones(created_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_strategic_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_strategic_milestones_updated_at
    BEFORE UPDATE ON public.strategic_milestones
    FOR EACH ROW
    EXECUTE FUNCTION public.update_strategic_milestones_updated_at();


-- ----------------------------------------------------------------------------
-- 2. founder_memory — Persistent founder preferences, decisions, context
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_memory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category    TEXT CHECK (category IN ('preference', 'decision', 'context', 'instruction', 'relationship')),
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    created_by  UUID REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.founder_memory ENABLE ROW LEVEL SECURITY;

-- Each user sees their own entries; Founder sees everything
CREATE POLICY "founder_memory_select"
    ON public.founder_memory
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
        OR created_by = auth.uid()
    );

-- Anyone authenticated can insert their own memory entries
CREATE POLICY "founder_memory_insert"
    ON public.founder_memory
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Only the creator or Founder/OpsHead can update
CREATE POLICY "founder_memory_update"
    ON public.founder_memory
    FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
    );

-- Only the creator or Founder/OpsHead can delete
CREATE POLICY "founder_memory_delete"
    ON public.founder_memory
    FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_founder_memory_category   ON public.founder_memory(category);
CREATE INDEX IF NOT EXISTS idx_founder_memory_key        ON public.founder_memory(key);
CREATE INDEX IF NOT EXISTS idx_founder_memory_created_by ON public.founder_memory(created_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_founder_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_founder_memory_updated_at
    BEFORE UPDATE ON public.founder_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_founder_memory_updated_at();


-- ----------------------------------------------------------------------------
-- 3. executive_briefs — AI-generated executive summaries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.executive_briefs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_type      TEXT CHECK (brief_type IN ('morning', 'evening', 'weekly', 'ad_hoc')),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    content         JSONB NOT NULL,                       -- structured brief data
    data_sources    TEXT[] DEFAULT '{}',                   -- which systems contributed
    consultant_id   UUID REFERENCES public.consultants(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.executive_briefs ENABLE ROW LEVEL SECURITY;

-- Users see only their own briefs; Founder sees all
CREATE POLICY "executive_briefs_select"
    ON public.executive_briefs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
        OR consultant_id = auth.uid()
    );

-- System (service-role) or founder can insert briefs
CREATE POLICY "executive_briefs_insert"
    ON public.executive_briefs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead')
        )
        OR consultant_id = auth.uid()
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_executive_briefs_type         ON public.executive_briefs(brief_type);
CREATE INDEX IF NOT EXISTS idx_executive_briefs_generated_at  ON public.executive_briefs(generated_at);
CREATE INDEX IF NOT EXISTS idx_executive_briefs_consultant   ON public.executive_briefs(consultant_id);


-- ----------------------------------------------------------------------------
-- 4. Seed strategic_milestones for Arofur and Franchisee Kart
-- ----------------------------------------------------------------------------
-- NOTE: brand_id references are resolved by slug at insert time.
-- These use subqueries to look up the correct UUIDs.

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Arofur Revenue Target Q3 2026', 'Achieve quarterly franchise fee revenue target for Arofur premium furniture brand', 'revenue', 2500000.00, 1250000.00, 'INR', '2026-04-01', '2026-06-30', 'on_track', b.id, 'Strong Q2 results. 3 franchise agreements signed in May. Pipeline for June is healthy with 5 proposals in negotiation stage.'
FROM public.brands b WHERE b.slug = 'arofur' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Arofur Revenue Target Q3 2026'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Arofur Geographic Expansion', 'Open 10 new franchise outlets in Tier-2 cities across India', 'expansion', 10.00, 6.00, 'count', '2026-01-01', '2026-12-31', 'on_track', b.id, 'Outlets launched in Jaipur, Lucknow, Indore, Coimbatore, Bhopal, and Nagpur. Next targets: Kochi, Vizag, Surat, Mysore.'
FROM public.brands b WHERE b.slug = 'arofur' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Arofur Geographic Expansion'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Arofur Showroom Launch — Kolkata', 'Flagship showroom launch in Kolkata central business district', 'product', 1.00, 0.00, 'count', '2026-03-01', '2026-07-31', 'at_risk', b.id, 'Landlord negotiations stalled. Lease deposit terms under review. Backup location shortlisted at Salt Lake City.'
FROM public.brands b WHERE b.slug = 'arofur' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Arofur Showroom Launch — Kolkata'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Arofur Team Scaling', 'Hire 8 new RMs and 2 Brand Managers for Arofur division', 'team', 10.00, 5.00, 'count', '2026-01-01', '2026-09-30', 'on_track', b.id, '5 RMs onboarded. 2 more in final interview stage. Brand Manager positions posted on Naukri and LinkedIn.'
FROM public.brands b WHERE b.slug = 'arofur' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Arofur Team Scaling'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Arofur Supply Chain Partner', 'Secure exclusive supplier agreement with WoodCraft India for raw materials', 'partnership', 1.00, 0.00, 'count', '2026-04-01', '2026-08-31', 'behind', b.id, 'Initial MOU drafted. Legal review pending since 3 weeks. Follow-up scheduled with their leadership next week.'
FROM public.brands b WHERE b.slug = 'arofur' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Arofur Supply Chain Partner'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Arofur Operational Efficiency', 'Reduce average outlet setup time from 90 days to 60 days', 'operational', 60.00, 72.00, 'count', '2026-01-01', '2026-12-31', 'on_track', b.id, 'New SOP streamlined vendor coordination. Last 3 outlets averaged 72 days. Target achievable with current trajectory.'
FROM public.brands b WHERE b.slug = 'arofur' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Arofur Operational Efficiency'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Franchisee Kart Revenue Target Q3 2026', 'Achieve quarterly consulting revenue target for FK platform', 'revenue', 1800000.00, 950000.00, 'INR', '2026-04-01', '2026-06-30', 'on_track', b.id, 'Consulting fees collected: 9.5L INR. 12 new franchisee sign-ups in pipeline for closing before quarter end.'
FROM public.brands b WHERE b.slug = 'franchisee-kart' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Franchisee Kart Revenue Target Q3 2026'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Franchisee Kart Brand Onboarding', 'Onboard 5 new franchise brands onto the FK consulting platform', 'partnership', 5.00, 3.00, 'count', '2026-01-01', '2026-12-31', 'on_track', b.id, '3 brands onboarded: Tandoori Treats, GreenLeaf Organics, QuickFix Electronics. 2 more in advanced discussions.'
FROM public.brands b WHERE b.slug = 'franchisee-kart' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Franchisee Kart Brand Onboarding'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Franchisee Kart Lead Conversion Rate', 'Improve lead-to-onboarded conversion rate from 8% to 15%', 'operational', 15.00, 10.50, 'percentage', '2026-01-01', '2026-12-31', 'on_track', b.id, 'Current rate at 10.5%. Follow-up AI engine deployment showing early results. Need RM training push in Q3.'
FROM public.brands b WHERE b.slug = 'franchisee-kart' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Franchisee Kart Lead Conversion Rate'
);

INSERT INTO public.strategic_milestones (title, description, milestone_type, target_value, current_value, unit, baseline_date, target_date, status, brand_id, progress_notes)
SELECT 'Franchisee Kart Team Headcount', 'Expand consulting team with 6 additional RMs across North India', 'team', 6.00, 2.00, 'count', '2026-01-01', '2026-09-30', 'behind', b.id, 'Only 2 of 6 positions filled. Hiring bottleneck due to high attrition in franchise industry. Considering lateral hires from real estate.'
FROM public.brands b WHERE b.slug = 'franchisee-kart' AND NOT EXISTS (
    SELECT 1 FROM public.strategic_milestones sm WHERE sm.title = 'Franchisee Kart Team Headcount'
);


-- ----------------------------------------------------------------------------
-- 5. Comments for documentation
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.strategic_milestones IS 'Strategic goals and KPIs tracked by Founder/OpsHead, migrated from Chairman Partner OS. RLS: Founder/OpsHead see all, others see brand-specific via consultant_brands.';
COMMENT ON TABLE public.founder_memory IS 'Persistent memory for founder preferences, decisions, context. Each user sees own entries; Founder/OpsHead see all. Auto-populated by founder-executive AI.';
COMMENT ON TABLE public.executive_briefs IS 'AI-generated executive briefs (morning, evening, weekly, ad-hoc). Stored for audit and review. Each consultant sees own; Founder sees all.';
