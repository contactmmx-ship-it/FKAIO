-- ============================================================================
-- Migration: Phase J — Governance and Approval System
-- Description: Approval queue, rules engine, AI agent guardrails, and
--              human override logging for governance.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. approval_queue — Items requiring human approval
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_queue (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type             TEXT NOT NULL CHECK (action_type IN ('refund', 'contract', 'payment', 'legal', 'pricing', 'escalation', 'ai_action', 'data_export', 'bulk_operation')),
    entity_type             TEXT NOT NULL,
    entity_id               UUID,
    request_data            JSONB NOT NULL,
    requested_by_agent_id   UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    requested_by_user_id    UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
    risk_level              TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'auto_approved')),
    threshold_rule          TEXT,
    reviewer_id             UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
    review_notes            TEXT,
    reviewed_at             TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    resolution_data         JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_queue ENABLE ROW LEVEL SECURITY;

-- Approval queue: assigned reviewer can see their items + admins see all
CREATE POLICY "approval_queue_select_reviewer_or_admin"
    ON public.approval_queue
    FOR SELECT
    TO authenticated
    USING (
        reviewer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'Admin')
        )
    );

-- Approval queue: anyone authenticated can create (system or agent-driven)
CREATE POLICY "approval_queue_insert_authenticated"
    ON public.approval_queue
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Approval queue: only the assigned reviewer or admin can update
CREATE POLICY "approval_queue_update_reviewer_or_admin"
    ON public.approval_queue
    FOR UPDATE
    TO authenticated
    USING (
        reviewer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'Admin')
        )
    );

-- Indexes for approval_queue
CREATE INDEX IF NOT EXISTS idx_approval_queue_action_type ON public.approval_queue(action_type);
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON public.approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_reviewer_id ON public.approval_queue(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_risk_level ON public.approval_queue(risk_level);
CREATE INDEX IF NOT EXISTS idx_approval_queue_requested_by_agent_id ON public.approval_queue(requested_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_requested_by_user_id ON public.approval_queue(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_entity ON public.approval_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_expires_at ON public.approval_queue(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_queue_created_at ON public.approval_queue(created_at DESC);


-- ----------------------------------------------------------------------------
-- 2. approval_rules — Rules defining what needs approval
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_rules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name               TEXT UNIQUE NOT NULL,
    action_type             TEXT NOT NULL,
    conditions              JSONB NOT NULL,
    threshold_value         NUMERIC(12,2),
    threshold_type          TEXT CHECK (threshold_type IN ('amount', 'count', 'percentage', 'risk_score')),
    auto_approve_below      BOOLEAN NOT NULL DEFAULT false,
    auto_approve_threshold  NUMERIC(12,2),
    required_roles          TEXT[] NOT NULL DEFAULT '{Founder, OpsHead}',
    escalation_timeout_hours INTEGER NOT NULL DEFAULT 48,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for approval_rules
CREATE INDEX IF NOT EXISTS idx_approval_rules_action_type ON public.approval_rules(action_type);
CREATE INDEX IF NOT EXISTS idx_approval_rules_is_active ON public.approval_rules(is_active);


-- ----------------------------------------------------------------------------
-- 3. agent_guardrails — Constraints on AI agent behavior
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_guardrails (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    rule_type   TEXT NOT NULL CHECK (rule_type IN ('spend_limit', 'rate_limit', 'action_scope', 'content_filter', 'approval_required', 'time_restriction')),
    rule_config JSONB NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id, rule_type)
);

-- Indexes for agent_guardrails
CREATE INDEX IF NOT EXISTS idx_agent_guardrails_agent_id ON public.agent_guardrails(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_guardrails_rule_type ON public.agent_guardrails(rule_type);
CREATE INDEX IF NOT EXISTS idx_agent_guardrails_is_active ON public.agent_guardrails(is_active);


-- ----------------------------------------------------------------------------
-- 4. human_override_log — Record of human interventions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.human_override_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    related_dispatch_id     UUID REFERENCES public.agent_dispatch_log(id) ON DELETE SET NULL,
    related_approval_id     UUID REFERENCES public.approval_queue(id) ON DELETE SET NULL,
    override_type           TEXT NOT NULL CHECK (override_type IN ('cancelled', 'modified', 'escalated', 'approved', 'rejected', 'paused')),
    original_action         JSONB NOT NULL,
    override_action         JSONB,
    reason                  TEXT,
    overridden_by           UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.human_override_log ENABLE ROW LEVEL SECURITY;

-- Human override log: all authenticated users can read (transparency)
CREATE POLICY "human_override_log_select_authenticated"
    ON public.human_override_log
    FOR SELECT
    TO authenticated
    USING (true);

-- Human override log: admins can insert
CREATE POLICY "human_override_log_insert_admin"
    ON public.human_override_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultants
            WHERE consultants.id = auth.uid()
              AND consultants.role IN ('Founder', 'OpsHead', 'Admin')
        )
    );


-- ----------------------------------------------------------------------------
-- 5. Seed approval_rules
-- ----------------------------------------------------------------------------
INSERT INTO public.approval_rules (rule_name, action_type, conditions, threshold_value, threshold_type, auto_approve_below, auto_approve_threshold, required_roles, escalation_timeout_hours, is_active)
VALUES
    (
        'Refund above threshold',
        'refund',
        '{"amount_gt": 10000}'::JSONB,
        10000.00,
        'amount',
        true,
        10000.00,
        '{Founder}',
        48,
        true
    ),
    (
        'Contract changes',
        'contract',
        '{"any": true}'::JSONB,
        NULL,
        NULL,
        false,
        NULL,
        '{Founder, OpsHead}',
        72,
        true
    ),
    (
        'Payment above threshold',
        'payment',
        '{"amount_gt": 50000}'::JSONB,
        50000.00,
        'amount',
        true,
        50000.00,
        '{Founder}',
        24,
        true
    ),
    (
        'Legal escalation',
        'legal',
        '{"any": true}'::JSONB,
        NULL,
        NULL,
        false,
        NULL,
        '{Founder}',
        24,
        true
    ),
    (
        'Pricing negotiation',
        'pricing',
        '{"any": true}'::JSONB,
        NULL,
        NULL,
        false,
        NULL,
        '{Founder}',
        48,
        true
    ),
    (
        'AI bulk action',
        'ai_action',
        '{"entity_count_gt": 10}'::JSONB,
        10.00,
        'count',
        false,
        NULL,
        '{Founder, OpsHead}',
        24,
        true
    )
ON CONFLICT (rule_name) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 6. Function: expire stale approval queue entries
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_approvals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.approval_queue
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING COUNT(*) INTO expired_count;

    RETURN COALESCE(expired_count, 0);
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION public.expire_stale_approvals() IS 'Marks expired approval queue entries. Intended to be called by pg_cron on a schedule.';


-- ----------------------------------------------------------------------------
-- 7. Function: auto-assign reviewer for new approval queue entries
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_approval_reviewer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    matching_rule RECORD;
    available_reviewer UUID;
BEGIN
    -- Find the first active approval rule matching this action_type
    SELECT ar.id, ar.required_roles
    INTO matching_rule
    FROM public.approval_rules ar
    WHERE ar.action_type = NEW.action_type
      AND ar.is_active = true
    ORDER BY ar.created_at ASC
    LIMIT 1;

    IF matching_rule.id IS NOT NULL THEN
        -- Find a consultant with one of the required roles
        SELECT c.id
        INTO available_reviewer
        FROM public.consultants c
        WHERE c.role = ANY(matching_rule.required_roles)
          AND c.is_active = true
        ORDER BY c.created_at ASC
        LIMIT 1;

        IF available_reviewer IS NOT NULL THEN
            NEW.reviewer_id := available_reviewer;
        END IF;

        NEW.threshold_rule := (
            SELECT ar.rule_name
            FROM public.approval_rules ar
            WHERE ar.id = matching_rule.id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approval_queue_assign_reviewer
    BEFORE INSERT ON public.approval_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_approval_reviewer();