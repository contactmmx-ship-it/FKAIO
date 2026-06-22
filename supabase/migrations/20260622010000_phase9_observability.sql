-- ============================================================================
-- Phase 9: Observability — Metrics & Agent Memory OAuth Support
-- ============================================================================
-- Creates structured metrics tables for application telemetry (latency,
-- token usage, cost, conversions, errors). Adds 'oauth' to agent_memory
-- memory_type CHECK constraint so OAuth tokens can be stored there.
--
-- Tables created:
--   metrics            — Raw metric data points (time-series)
--   metric_aggregates  — Pre-computed daily/hourly summaries
--
-- Indexes: Optimized for time-range queries with optional name/tag filters.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Extend agent_memory memory_type to include 'oauth'
-- ──────────────────────────────────────────────
-- PostgreSQL does not support ALTER TABLE ... ALTER CONSTRAINT on CHECK
-- constraints, so we drop and recreate the constraint.
ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_memory_type_check;

ALTER TABLE agent_memory ADD CONSTRAINT agent_memory_memory_type_check
  CHECK (memory_type IN (
    'context',
    'learning',
    'preference',
    'conversation',
    'task_result',
    'oauth'
  ));

-- ──────────────────────────────────────────────
-- 2. Create metrics table (raw data points)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT 'count',
  tags jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE metrics IS
'Phase 9 observability: Raw metric data points. Each row is a single measurement.
Populated by edge functions via recordMetric(). Queried by getMetrics().';

COMMENT ON COLUMN metrics.name IS
'Metric name, e.g. api_latency_ms, ai_tokens_used, ai_cost_usd, error_count';

COMMENT ON COLUMN metrics.value IS
'Numeric measurement value';

COMMENT ON COLUMN metrics.unit IS
'Unit of measurement: ms, tokens, usd, count, percent, etc.';

COMMENT ON COLUMN metrics.tags IS
'JSONB key-value tags for filtering. Common keys: function, model, status, error_type.';

-- Enable RLS
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

-- Service role can do everything; authenticated users can read
CREATE POLICY "select_metrics" ON metrics FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_metrics" ON metrics FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "delete_metrics" ON metrics FOR DELETE
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 3. Create metric_aggregates table (pre-computed summaries)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metric_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  period_date date NOT NULL,
  period_type text NOT NULL DEFAULT 'daily'
    CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
  count integer NOT NULL DEFAULT 0,
  sum numeric NOT NULL DEFAULT 0,
  avg numeric NOT NULL DEFAULT 0,
  min_val numeric,
  max_val numeric,
  p50 numeric,
  p95 numeric,
  p99 numeric,
  tags jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_name, period_date, period_type, tags)
);

COMMENT ON TABLE metric_aggregates IS
'Phase 9 observability: Pre-computed metric summaries for dashboard queries.
Populated by the compute_metric_aggregates() function or a scheduled job.';

COMMENT ON COLUMN metric_aggregates.period_date IS
'The date (or hour-start timestamp for hourly) this aggregate covers.';

COMMENT ON COLUMN metric_aggregates.tags IS
'JSONB tags that were present on the source metrics. Used for filtering.
Empty object {} means "all tags" (ungrouped aggregate).';

-- Enable RLS
ALTER TABLE metric_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_metric_aggregates" ON metric_aggregates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_metric_aggregates" ON metric_aggregates FOR INSERT
  TO authenticated WITH CHECK (true);

-- ──────────────────────────────────────────────
-- 4. Indexes for efficient querying
-- ──────────────────────────────────────────────

-- Primary query pattern: time range + optional name filter
CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON metrics (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics (name);
CREATE INDEX IF NOT EXISTS idx_metrics_name_recorded ON metrics (name, recorded_at DESC);

-- Tag filtering — GIN index for JSONB
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON metrics USING gin (tags);

-- Compound index for the most common query: name + time range
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics (name, recorded_at DESC)
  WHERE recorded_at > now() - INTERVAL '90 days';

-- Metric aggregates indexes
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_name ON metric_aggregates (metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_period ON metric_aggregates (period_date DESC, period_type);
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_name_period ON metric_aggregates (metric_name, period_date DESC, period_type);
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_tags ON metric_aggregates USING gin (tags);

-- ──────────────────────────────────────────────
-- 5. Function: compute_metric_aggregates()
-- ──────────────────────────────────────────────
-- Computes daily aggregates for a given date (or yesterday by default).
-- Call this from a scheduled job (Vercel Cron, GitHub Actions, etc.).
-- Returns a summary of what was computed.
CREATE OR REPLACE FUNCTION compute_metric_aggregates(target_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
  v_metric_names text[];
  v_total_computed integer := 0;
BEGIN
  -- Default to yesterday
  v_date := COALESCE(target_date, CURRENT_DATE - INTERVAL '1 day');
  v_start := v_date::timestamptz;
  v_end := (v_date + INTERVAL '1 day')::timestamptz;

  -- Get distinct metric names that have data in this period
  SELECT ARRAY_AGG(DISTINCT name) INTO v_metric_names
  FROM metrics
  WHERE recorded_at >= v_start AND recorded_at < v_end;

  -- Process each metric
  IF v_metric_names IS NOT NULL THEN
    FOREACH v_mname IN ARRAY v_metric_names LOOP
      -- Ungrouped aggregate (all tags)
      INSERT INTO metric_aggregates (metric_name, period_date, period_type, count, sum, avg, min_val, max_val, p50, p95, p99, tags)
      SELECT
        v_mname,
        v_date,
        'daily',
        COUNT(*),
        ROUND(SUM(value)::numeric, 6),
        ROUND(AVG(value)::numeric, 6),
        ROUND(MIN(value)::numeric, 6),
        ROUND(MAX(value)::numeric, 6),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)::numeric, 6),
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric, 6),
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value)::numeric, 6),
        '{}'::jsonb
      FROM metrics
      WHERE name = v_mname
        AND recorded_at >= v_start
        AND recorded_at < v_end
      ON CONFLICT (metric_name, period_date, period_type, tags) DO UPDATE SET
        count        = EXCLUDED.count,
        sum          = EXCLUDED.sum,
        avg          = EXCLUDED.avg,
        min_val      = EXCLUDED.min_val,
        max_val      = EXCLUDED.max_val,
        p50          = EXCLUDED.p50,
        p95          = EXCLUDED.p95,
        p99          = EXCLUDED.p99,
        computed_at  = now();

      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total_computed := v_total_computed + v_count;

      -- Per-function aggregates (grouped by tags->>'function')
      INSERT INTO metric_aggregates (metric_name, period_date, period_type, count, sum, avg, min_val, max_val, p50, p95, p99, tags)
      SELECT
        v_mname,
        v_date,
        'daily',
        COUNT(*),
        ROUND(SUM(value)::numeric, 6),
        ROUND(AVG(value)::numeric, 6),
        ROUND(MIN(value)::numeric, 6),
        ROUND(MAX(value)::numeric, 6),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)::numeric, 6),
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric, 6),
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value)::numeric, 6),
        jsonb_build_object('function', tags->>'function')
      FROM metrics
      WHERE name = v_mname
        AND recorded_at >= v_start
        AND recorded_at < v_end
        AND tags->>'function' IS NOT NULL
      GROUP BY tags->>'function'
      ON CONFLICT (metric_name, period_date, period_type, tags) DO UPDATE SET
        count        = EXCLUDED.count,
        sum          = EXCLUDED.sum,
        avg          = EXCLUDED.avg,
        min_val      = EXCLUDED.min_val,
        max_val      = EXCLUDED.max_val,
        p50          = EXCLUDED.p50,
        p95          = EXCLUDED.p95,
        p99          = EXCLUDED.p99,
        computed_at  = now();

      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total_computed := v_total_computed + v_count;
    END LOOP;
  END IF;

  -- Clean up raw metrics older than 90 days to keep the table manageable
  DELETE FROM metrics WHERE recorded_at < now() - INTERVAL '90 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'target_date',      v_date,
    'metrics_computed', v_total_computed,
    'metrics_found',    COALESCE(array_length(v_metric_names, 1), 0),
    'rows_deleted',     v_count,
    'computed_at',      now()
  );
END;
$$;

COMMENT ON FUNCTION compute_metric_aggregates IS
'Phase 9: Computes daily metric aggregates and cleans up raw data older than 90 days.
Schedule daily at 03:00 UTC via Vercel Cron / GitHub Actions / Supabase webhook.
Usage: SELECT compute_metric_aggregates();  -- yesterday
       SELECT compute_metric_aggregates('2026-06-20'::date);  -- specific date';

-- ──────────────────────────────────────────────
-- 6. Ensure meetings table has google_calendar_event_id column
-- ──────────────────────────────────────────────
-- The meeting-scheduler edge function stores the Google Calendar event ID
-- for CRUD operations. Add the column if it doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'google_calendar_event_id'
  ) THEN
    ALTER TABLE meetings ADD COLUMN google_calendar_event_id text;
    CREATE INDEX IF NOT EXISTS idx_meetings_gcal_event ON meetings (google_calendar_event_id)
      WHERE google_calendar_event_id IS NOT NULL;
  END IF;
END $$;