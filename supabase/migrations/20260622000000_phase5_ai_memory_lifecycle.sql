-- ============================================================================
-- Phase 5: AI Memory Lifecycle Management
-- ============================================================================
-- Adds memory_category, last_accessed_at, reference_count to agent_memory.
-- Creates cleanup_expired_memories() for automated memory lifecycle management.
--
-- Scheduled trigger note:
--   Supabase free tier does NOT include pg_cron. To run cleanup daily, use
--   one of the following approaches:
--     1. Supabase Dashboard → Database → Webhooks → schedule a daily POST
--        to a lightweight edge function that calls:
--          SELECT cleanup_expired_memories();
--     2. Vercel Cron (vercel.json) hitting an edge function endpoint.
--     3. GitHub Actions scheduled workflow calling the Supabase SQL API.
--   Recommended interval: once per day at 02:00 UTC.
-- ============================================================================

-- 1. Add memory_category column
ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS memory_category text
    DEFAULT 'short_term'
    CHECK (memory_category IN ('short_term', 'long_term', 'task_result'));

-- Backfill existing rows: task_result type maps to 'task_result' category,
-- everything else defaults to 'short_term' (already the column default).
UPDATE agent_memory
SET memory_category = CASE
  WHEN memory_type = 'task_result' THEN 'task_result'
  ELSE 'short_term'
END
WHERE memory_category IS NULL;

-- 2. Add last_accessed_at column
ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz DEFAULT now();

-- 3. Add reference_count column
ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS reference_count integer NOT NULL DEFAULT 0;

-- 4. Indexes for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(memory_category);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expires ON agent_memory(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_memory_last_accessed ON agent_memory(last_accessed_at);

-- 5. Function: cleanup_expired_memories()
--    - Deletes expired short_term memories
--    - Promotes frequently-accessed short_term memories to long_term
--    - Returns statistics about what was cleaned
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
  promoted_count integer;
BEGIN
  -- ── Step 1: Delete expired short_term memories ──
  DELETE FROM agent_memory
  WHERE expires_at < now()
    AND memory_category = 'short_term';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- ── Step 2: Promote short_term memories accessed >10 times to long_term ──
  --    Promoted memories lose their expires_at (long_term = permanent)
  UPDATE agent_memory
  SET memory_category  = 'long_term',
      expires_at       = NULL,
      last_accessed_at = now()
  WHERE memory_category = 'short_term'
    AND reference_count > 10;

  GET DIAGNOSTICS promoted_count = ROW_COUNT;

  -- ── Return cleanup statistics ──
  RETURN jsonb_build_object(
    'deleted_expired',  deleted_count,
    'promoted_to_long', promoted_count,
    'ran_at',           now()
  );
END;
$$;

-- Comment documenting the scheduled trigger intention
COMMENT ON FUNCTION cleanup_expired_memories() IS
'Phase 5 memory lifecycle cleanup. Should be scheduled to run daily.
Deletes expired short_term memories and promotes frequently-accessed
(>10 references) short_term memories to long_term (permanent).
On Supabase free tier, trigger via external cron (Vercel/GitHub Actions)
calling an edge function that invokes: SELECT cleanup_expired_memories();';