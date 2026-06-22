/*
# Phase 4: Automation Triggers

1. auto_qualify_new_lead() — AFTER INSERT on leads → queue QUALIFY_LEAD job
2. auto_followup_stage_change() — AFTER UPDATE on leads (stage changed) → queue FOLLOW_UP job
3. auto_schedule_meeting() — AFTER UPDATE on leads (stage → 'Meeting Scheduled') → queue SCHEDULE_MEETING job
4. auto_generate_proposal() — AFTER UPDATE on leads (stage → 'Proposal Sent') → queue GENERATE_PROPOSAL job
5. auto_invoice_onboarding() — AFTER UPDATE on leads (stage → 'Agreement') → queue GENERATE_INVOICE job

All triggers use NEW/OLD row references and only fire when the stage has actually changed.
*/

-- ──────────────────────────────────────────────
-- 1. Auto-qualify every newly inserted lead
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_qualify_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ai_jobs (agent_id, type, payload, status)
  SELECT
    a.id,
    'QUALIFY_LEAD',
    jsonb_build_object(
      'lead_id', NEW.id::text,
      'name', NEW.name,
      'investment_capacity', COALESCE(NEW.investment_capacity, ''),
      'city', COALESCE(NEW.city, ''),
      'source', COALESCE(NEW.source, 'Website')
    ),
    'pending'
  FROM ai_agents a
  WHERE a.task = 'QUALIFY_LEAD'
    AND a.is_active = true
  LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_qualify_new_lead ON leads;
CREATE TRIGGER trg_auto_qualify_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_qualify_new_lead();

-- ──────────────────────────────────────────────
-- 2. Auto follow-up on any stage change
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_followup_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when stage has actually changed
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO ai_jobs (agent_id, type, payload, status)
    SELECT
      a.id,
      'FOLLOW_UP',
      jsonb_build_object(
        'lead_id', NEW.id::text,
        'old_stage', OLD.stage,
        'new_stage', NEW.stage,
        'lead_name', NEW.name
      ),
      'pending'
    FROM ai_agents a
    WHERE a.task = 'FOLLOW_UP'
      AND a.is_active = true
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_followup_stage_change ON leads;
CREATE TRIGGER trg_auto_followup_stage_change
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_followup_stage_change();

-- ──────────────────────────────────────────────
-- 3. Auto schedule meeting when stage → 'Meeting Scheduled'
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_schedule_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when stage just changed TO 'Meeting Scheduled'
  IF OLD.stage IS DISTINCT FROM NEW.stage
     AND NEW.stage = 'Meeting Scheduled' THEN
    INSERT INTO ai_jobs (agent_id, type, payload, status)
    SELECT
      a.id,
      'SCHEDULE_MEETING',
      jsonb_build_object(
        'lead_id', NEW.id::text,
        'lead_name', NEW.name,
        'assigned_to', COALESCE(NEW.assigned_to::text, ''),
        'brand_id', COALESCE(NEW.brand_id::text, ''),
        'city', COALESCE(NEW.city, '')
      ),
      'pending'
    FROM ai_agents a
    WHERE a.task = 'SCHEDULE_MEETING'
      AND a.is_active = true
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_schedule_meeting ON leads;
CREATE TRIGGER trg_auto_schedule_meeting
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_schedule_meeting();

-- ──────────────────────────────────────────────
-- 4. Auto generate proposal when stage → 'Proposal Sent'
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_generate_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when stage just changed TO 'Proposal Sent'
  IF OLD.stage IS DISTINCT FROM NEW.stage
     AND NEW.stage = 'Proposal Sent' THEN
    INSERT INTO ai_jobs (agent_id, type, payload, status)
    SELECT
      a.id,
      'GENERATE_PROPOSAL',
      jsonb_build_object(
        'lead_id', NEW.id::text,
        'lead_name', NEW.name,
        'investment_capacity', COALESCE(NEW.investment_capacity, ''),
        'brand_id', COALESCE(NEW.brand_id::text, ''),
        'city', COALESCE(NEW.city, ''),
        'state', COALESCE(NEW.state, '')
      ),
      'pending'
    FROM ai_agents a
    WHERE a.task = 'GENERATE_PROPOSAL'
      AND a.is_active = true
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_proposal ON leads;
CREATE TRIGGER trg_auto_generate_proposal
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_proposal();

-- ──────────────────────────────────────────────
-- 5. Auto generate invoice when stage → 'Agreement'
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_invoice_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when stage just changed TO 'Agreement'
  IF OLD.stage IS DISTINCT FROM NEW.stage
     AND NEW.stage = 'Agreement' THEN
    INSERT INTO ai_jobs (agent_id, type, payload, status)
    SELECT
      a.id,
      'GENERATE_INVOICE',
      jsonb_build_object(
        'lead_id', NEW.id::text,
        'lead_name', NEW.name,
        'brand_id', COALESCE(NEW.brand_id::text, ''),
        'investment_capacity', COALESCE(NEW.investment_capacity, ''),
        'city', COALESCE(NEW.city, '')
      ),
      'pending'
    FROM ai_agents a
    WHERE a.task = 'GENERATE_INVOICE'
      AND a.is_active = true
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_invoice_onboarding ON leads;
CREATE TRIGGER trg_auto_invoice_onboarding
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_invoice_onboarding();

-- ──────────────────────────────────────────────
-- Index for trigger performance: ensure ai_jobs
-- lookups by agent task are fast
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type ON ai_jobs(type);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_pending ON ai_jobs(created_at DESC) WHERE status = 'pending';