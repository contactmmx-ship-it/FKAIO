-- ============================================================================
-- Phase C: AI Workforce Orchestration System
-- ============================================================================
-- Creates the scheduling, dispatch, and lifecycle-tracking infrastructure
-- that lets AI agents operate autonomously across the full sales pipeline.
--
-- Tables created:
--   agent_lifecycle_stages  — 9-stage pipeline reference table
--   agent_schedules         — When and how each agent should run
--   agent_dispatch_log      — Immutable audit trail of every agent action
--   lead_lifecycle          — Tracks where each lead sits in the pipeline
--
-- Indexes: Optimised for schedule polling, dispatch lookups, and pipeline
--          stage queries.
-- Triggers: updated_at auto-refresh + schedule next_run_at calculator.
-- RLS:      Role-scoped policies following the existing RBAC model.
-- ============================================================================

-- ============================================================
-- 1. AGENT LIFECYCLE STAGES (enum-like reference table)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_lifecycle_stages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name          TEXT UNIQUE NOT NULL,
  stage_order         INTEGER UNIQUE NOT NULL,
  description         TEXT,
  trigger_conditions  JSONB NOT NULL DEFAULT '{}',
  escalation_rules    JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE agent_lifecycle_stages ENABLE ROW LEVEL SECURITY;

-- Seed the 9 pipeline stages (idempotent: skip if already present)
INSERT INTO agent_lifecycle_stages (stage_name, stage_order, description, trigger_conditions, escalation_rules)
VALUES
  ('Lead Generation', 1,
   'Automated outreach and initial lead capture via ads, referrals, and inbound funnels.',
   '{"min_lead_score": 0, "required_fields": ["name", "email"]}',
   '{"escalate_after_hours": 24, "escalate_to_role": "RM"}'),
  ('Qualification', 2,
   'AI scores and qualifies leads based on investment capacity, engagement, and fit.',
   '{"min_lead_score": 25, "required_fields": ["name", "email", "mobile", "city"]}',
   '{"escalate_after_hours": 48, "escalate_to_role": "BrandManager"}'),
  ('Nurture', 3,
   'Automated follow-ups, content delivery, and relationship building for warm leads.',
   '{"min_lead_score": 40}',
   '{"escalate_after_days_inactive": 14, "escalate_to_role": "RM"}'),
  ('Meeting', 4,
   'Scheduling, preparing agendas, and sending reminders for discovery/demo calls.',
   '{"required_fields": ["name", "email", "mobile"]}',
   '{"no_show_count": 2, "escalate_to_role": "RM"}'),
  ('Proposal', 5,
   'Generating and sending tailored proposals, pricing sheets, and brand decks.',
   '{"min_lead_score": 55, "has_meeting_completed": true}',
   '{"followup_count": 3, "escalate_to_role": "BrandManager"}'),
  ('Closer', 6,
   'Handling objections, negotiating terms, and driving towards conversion.',
   '{"min_lead_score": 70, "proposal_sent": true}',
   '{"stall_days": 7, "escalate_to_role": "Founder"}'),
  ('Onboarding', 7,
   'Post-sale activation: document collection, training setup, and account provisioning.',
   '{"stage": "Agreement", "payment_received": true}',
   '{"delay_days": 5, "escalate_to_role": "OpsHead"}'),
  ('Customer Success', 8,
   'Ongoing support, satisfaction monitoring, upsell opportunities, and retention.',
   '{"onboarding_completed": true}',
   '{"csat_below": 3, "escalate_to_role": "OpsHead"}'),
  ('Renewal', 9,
   'Contract renewal outreach, renegotiation, and lifetime value maximisation.',
   '{"days_to_expiry": 90}',
   '{"no_response_days": 21, "escalate_to_role": "Founder"}')
ON CONFLICT (stage_name) DO NOTHING;


-- ============================================================
-- 2. AGENT SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  schedule_type       TEXT NOT NULL CHECK (schedule_type IN ('cron', 'event_trigger', 'interval', 'manual')),
  cron_expression     TEXT,                          -- only for 'cron'
  interval_seconds    INTEGER,                       -- only for 'interval'
  event_trigger       TEXT,                          -- only for 'event_trigger'
  lifecycle_stage_id  UUID REFERENCES agent_lifecycle_stages(id) ON DELETE SET NULL,
  brand_id            UUID REFERENCES brands(id) ON DELETE CASCADE,
  conditions          JSONB NOT NULL DEFAULT '{}',  -- preconditions for execution
  max_retries         INTEGER NOT NULL DEFAULT 3,
  retry_delay_seconds INTEGER NOT NULL DEFAULT 300,
  timeout_seconds     INTEGER NOT NULL DEFAULT 120,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_run_at         TIMESTAMPTZ,
  next_run_at         TIMESTAMPTZ,
  run_count           INTEGER NOT NULL DEFAULT 0,
  failure_count       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Schedule type must match its associated field
  CONSTRAINT chk_schedule_cron CHECK (
    schedule_type <> 'cron'     OR cron_expression IS NOT NULL
  ),
  CONSTRAINT chk_schedule_interval CHECK (
    schedule_type <> 'interval'  OR interval_seconds IS NOT NULL
  ),
  CONSTRAINT chk_schedule_event CHECK (
    schedule_type <> 'event_trigger' OR event_trigger IS NOT NULL
  )
);

ALTER TABLE agent_schedules ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. AGENT DISPATCH LOG (immutable audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_dispatch_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id         UUID REFERENCES agent_schedules(id) ON DELETE SET NULL,
  agent_id            UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  job_id              UUID REFERENCES ai_jobs(id) ON DELETE SET NULL,
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  brand_id            UUID REFERENCES brands(id) ON DELETE SET NULL,
  lifecycle_stage_id  UUID REFERENCES agent_lifecycle_stages(id) ON DELETE SET NULL,
  action              TEXT NOT NULL,
  input_data          JSONB NOT NULL DEFAULT '{}',
  output_data         JSONB NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL CHECK (status IN (
                       'dispatched', 'running', 'completed', 'failed', 'timeout', 'escalated'
                     )),
  error_message       TEXT,
  duration_ms         INTEGER,
  tokens_used         INTEGER,
  cost_usd            NUMERIC(10, 6),
  escalated_to        UUID REFERENCES consultants(id),
  human_override      BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_dispatch_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. LEAD LIFECYCLE (pipeline state tracker)
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_lifecycle (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  current_stage_id         UUID REFERENCES agent_lifecycle_stages(id),
  entered_stage_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  stage_history            JSONB NOT NULL DEFAULT '[]',
  assigned_agents          UUID[] NOT NULL DEFAULT '{}',
  next_action              TEXT,
  next_action_scheduled_at TIMESTAMPTZ,
  blocked                  BOOLEAN NOT NULL DEFAULT false,
  blocked_reason           TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_lifecycle ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. UPDATED_AT TRIGGERS (all timestamped tables)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_schedules_updated_at ON agent_schedules;
CREATE TRIGGER trg_agent_schedules_updated_at
  BEFORE UPDATE ON agent_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lead_lifecycle_updated_at ON lead_lifecycle;
CREATE TRIGGER trg_lead_lifecycle_updated_at
  BEFORE UPDATE ON lead_lifecycle
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- ----- agent_lifecycle_stages: SELECT for all authenticated -----
DROP POLICY IF EXISTS agent_lifecycle_stages_select ON agent_lifecycle_stages;
CREATE POLICY agent_lifecycle_stages_select ON agent_lifecycle_stages
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE — stages are managed by migrations only.
-- Service role bypasses RLS, so the orchestrator can read freely.


-- ----- agent_schedules -----
-- SELECT: all authenticated (needed for dashboards)
DROP POLICY IF EXISTS agent_schedules_select ON agent_schedules;
CREATE POLICY agent_schedules_select ON agent_schedules
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: admin only (Founder / OpsHead)
DROP POLICY IF EXISTS agent_schedules_insert ON agent_schedules;
CREATE POLICY agent_schedules_insert ON agent_schedules
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS agent_schedules_update ON agent_schedules;
CREATE POLICY agent_schedules_update ON agent_schedules
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS agent_schedules_delete ON agent_schedules;
CREATE POLICY agent_schedules_delete ON agent_schedules
  FOR DELETE TO authenticated USING (is_admin());


-- ----- agent_dispatch_log -----
-- SELECT: all authenticated (audit visibility for dashboards)
DROP POLICY IF EXISTS agent_dispatch_log_select ON agent_dispatch_log;
CREATE POLICY agent_dispatch_log_select ON agent_dispatch_log
  FOR SELECT TO authenticated USING (true);

-- INSERT: no explicit policy for authenticated — only the service_role
-- (edge functions / orchestrator) bypasses RLS and can insert.
-- This prevents accidental client-side inserts while keeping the
-- automated pipeline functional.

-- UPDATE: admin only (to correct errors, annotate, reclassify)
DROP POLICY IF EXISTS agent_dispatch_log_update ON agent_dispatch_log;
CREATE POLICY agent_dispatch_log_update ON agent_dispatch_log
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- ----- lead_lifecycle -----
-- SELECT: RM sees own leads, BrandManager sees brand leads, Founder/OpsHead see all
DROP POLICY IF EXISTS lead_lifecycle_select_own ON lead_lifecycle;
CREATE POLICY lead_lifecycle_select_own ON lead_lifecycle
  FOR SELECT TO authenticated
  USING (
    lead_id IN (SELECT id FROM leads WHERE assigned_to = get_my_consultant_id())
  );

DROP POLICY IF EXISTS lead_lifecycle_select_brand ON lead_lifecycle;
CREATE POLICY lead_lifecycle_select_brand ON lead_lifecycle
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'BrandManager'
    AND lead_id IN (
      SELECT id FROM leads
      WHERE brand_id IN (SELECT brand_id FROM consultant_brands WHERE consultant_id = get_my_consultant_id())
    )
  );

DROP POLICY IF EXISTS lead_lifecycle_select_all ON lead_lifecycle;
CREATE POLICY lead_lifecycle_select_all ON lead_lifecycle
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT: service_role only (orchestrator creates these).
-- No authenticated INSERT policy — the system writes via service_role.
-- UPDATE/DELETE: admin only (pipeline adjustments, corrections)
DROP POLICY IF EXISTS lead_lifecycle_update ON lead_lifecycle;
CREATE POLICY lead_lifecycle_update ON lead_lifecycle
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS lead_lifecycle_delete ON lead_lifecycle;
CREATE POLICY lead_lifecycle_delete ON lead_lifecycle
  FOR DELETE TO authenticated USING (is_admin());


-- ============================================================
-- 7. INDEXES
-- ============================================================

-- agent_schedules
CREATE INDEX IF NOT EXISTS idx_agent_schedules_agent_active
  ON agent_schedules (agent_id, is_active);

CREATE INDEX IF NOT EXISTS idx_agent_schedules_brand_type
  ON agent_schedules (brand_id, schedule_type);

CREATE INDEX IF NOT EXISTS idx_agent_schedules_next_run
  ON agent_schedules (next_run_at)
  WHERE is_active = true;

-- agent_dispatch_log
CREATE INDEX IF NOT EXISTS idx_agent_dispatch_log_agent_time
  ON agent_dispatch_log (agent_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_dispatch_log_lead_time
  ON agent_dispatch_log (lead_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_dispatch_log_status
  ON agent_dispatch_log (status);

CREATE INDEX IF NOT EXISTS idx_agent_dispatch_log_brand_time
  ON agent_dispatch_log (brand_id, created_at);

-- lead_lifecycle
CREATE INDEX IF NOT EXISTS idx_lead_lifecycle_stage
  ON lead_lifecycle (current_stage_id);

-- (lead_id UNIQUE constraint already covers single-column lookup)

CREATE INDEX IF NOT EXISTS idx_lead_lifecycle_next_action
  ON lead_lifecycle (next_action_scheduled_at)
  WHERE blocked = false;


-- ============================================================
-- 8. FUNCTION: update_schedule_next_run()
--    Calculates next_run_at based on schedule_type after each run.
--    Attach as a BEFORE UPDATE trigger on agent_schedules.
-- ============================================================
CREATE OR REPLACE FUNCTION update_schedule_next_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts  text[];
  v_min    text;
  v_hour   text;
  v_dom    text;
  v_month  text;
  v_dow    text;
  v_step   integer;
  v_next   timestamptz;
BEGIN
  -- Only recompute when run_count changes (i.e. a run just happened)
  IF NEW.run_count = OLD.run_count THEN
    RETURN NEW;
  END IF;

  CASE NEW.schedule_type
    -- ── interval: simply add interval_seconds ──
    WHEN 'interval' THEN
      IF NEW.interval_seconds IS NOT NULL AND NEW.interval_seconds > 0 THEN
        NEW.next_run_at := now() + (NEW.interval_seconds * interval '1 second');
      END IF;

    -- ── event_trigger: no scheduled next run ──
    WHEN 'event_trigger' THEN
      NEW.next_run_at := NULL;

    -- ── manual: no scheduled next run ──
    WHEN 'manual' THEN
      NEW.next_run_at := NULL;

    -- ── cron: parse common patterns ──
    WHEN 'cron' THEN
      IF NEW.cron_expression IS NULL OR NEW.cron_expression = '' THEN
        NEW.next_run_at := NULL;
      ELSE
        -- Split into 5 fields: min hour dom month dow
        v_parts  := regexp_split_to_array(NEW.cron_expression, '\s+');
        IF array_length(v_parts, 1) != 5 THEN
          -- Invalid expression — let the orchestrator handle it
          NEW.next_run_at := NULL;
          RETURN NEW;
        END IF;

        v_min   := v_parts[1];
        v_hour  := v_parts[2];
        v_dom   := v_parts[3];
        v_month := v_parts[4];
        v_dow   := v_parts[5];
        v_next  := now();

        -- --- Every N minutes (*/N * * * *) ---
        IF v_min LIKE '*/%' AND v_hour = '*' AND v_dom = '*' AND v_month = '*' AND v_dow = '*' THEN
          BEGIN
            v_step := substring(v_min FROM 3)::integer;
            IF v_step > 0 THEN
              -- Round up to the next N-minute boundary
              v_next := date_trunc('hour', v_next)
                        + (ceil(extract(minute FROM v_next)::numeric / v_step)::integer * v_step) * interval '1 minute';
              IF v_next <= now() THEN
                v_next := v_next + v_step * interval '1 minute';
              END IF;
              NEW.next_run_at := v_next;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            NEW.next_run_at := NULL;
          END;

        -- --- Specific minute of every hour (M * * * *) ---
        ELSIF v_hour = '*' AND v_dom = '*' AND v_month = '*' AND v_dow = '*'
              AND v_min ~ '^[0-5]?[0-9]$' THEN
          v_next := date_trunc('hour', v_next) + v_min::integer * interval '1 minute';
          IF v_next <= now() THEN
            v_next := v_next + interval '1 hour';
          END IF;
          NEW.next_run_at := v_next;

        -- --- Every N hours (0 */N * * *) ---
        ELSIF v_min = '0' AND v_hour LIKE '*/%' AND v_dom = '*' AND v_month = '*' AND v_dow = '*' THEN
          BEGIN
            v_step := substring(v_hour FROM 3)::integer;
            IF v_step > 0 THEN
              v_next := date_trunc('day', v_next)
                        + (ceil(extract(hour FROM v_next)::numeric / v_step)::integer * v_step) * interval '1 hour';
              IF v_next <= now() THEN
                v_next := v_next + v_step * interval '1 hour';
              END IF;
              NEW.next_run_at := v_next;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            NEW.next_run_at := NULL;
          END;

        -- --- Every day at midnight (0 0 * * *) ---
        --     Must precede the general (M H * * *) pattern below.
        ELSIF v_min = '0' AND v_hour = '0' AND v_dom = '*' AND v_month = '*' AND v_dow = '*' THEN
          v_next := date_trunc('day', v_next) + interval '1 day';
          NEW.next_run_at := v_next;

        -- --- Daily at a specific time (M H * * *) ---
        ELSIF v_dom = '*' AND v_month = '*' AND v_dow = '*'
              AND v_min ~ '^[0-5]?[0-9]$' AND v_hour ~ '^(1?[0-9]|2[0-3])$' THEN
          v_next := date_trunc('day', v_next)
                    + v_hour::integer * interval '1 hour'
                    + v_min::integer * interval '1 minute';
          IF v_next <= now() THEN
            v_next := v_next + interval '1 day';
          END IF;
          NEW.next_run_at := v_next;

        -- --- Every minute (* * * * *) ---
        ELSIF v_min = '*' AND v_hour = '*' AND v_dom = '*' AND v_month = '*' AND v_dow = '*' THEN
          v_next := date_trunc('minute', v_next) + interval '1 minute';
          NEW.next_run_at := v_next;

        -- --- Complex expression: fallback to NULL — the orchestrator
        --     edge function should compute the precise next_run_at ---
        ELSE
          NEW.next_run_at := NULL;
        END IF;
      END IF;

    ELSE
      NEW.next_run_at := NULL;
  END CASE;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_schedule_next_run() IS
'Phase C orchestration: Automatically computes next_run_at on agent_schedules
when run_count increments. Handles interval natively and parses common cron
patterns (every N minutes, hourly, daily, specific time). For complex cron
expressions, sets next_run_at to NULL so the orchestrator service can compute
the precise value using a full-featured cron library.';

-- Attach trigger
DROP TRIGGER IF EXISTS trg_update_schedule_next_run ON agent_schedules;
CREATE TRIGGER trg_update_schedule_next_run
  BEFORE UPDATE ON agent_schedules
  FOR EACH ROW EXECUTE FUNCTION update_schedule_next_run();


-- ============================================================
-- 9. COMPOSITE COMMENT / DOC BLOCK
-- ============================================================
COMMENT ON TABLE agent_lifecycle_stages IS
'Phase C: 9-stage sales pipeline reference table. Stages define the sequence
that AI agents follow when nurturing leads from first contact through renewal.
Trigger conditions and escalation rules are stored as JSONB for flexibility.';

COMMENT ON TABLE agent_schedules IS
'Phase C: Defines when and how each AI agent should execute. Supports cron,
event-driven, interval, and manual scheduling. The update_schedule_next_run()
trigger auto-calculates next_run_at after each successful dispatch.';

COMMENT ON TABLE agent_dispatch_log IS
'Phase C: Immutable audit trail of every agent action. Records input/output,
duration, token usage, cost, status, and escalation/human-override events.
Only the service_role (orchestrator) can insert; admins can update for
corrections or annotations.';

COMMENT ON TABLE lead_lifecycle IS
'Phase C: Tracks where each lead is in the 9-stage pipeline. Stores full
stage_history as a JSONB array for timeline reconstruction. next_action and
next_action_scheduled_at drive the orchestrator poll loop. blocked and
blocked_reason prevent agents from acting on stalled leads.';
