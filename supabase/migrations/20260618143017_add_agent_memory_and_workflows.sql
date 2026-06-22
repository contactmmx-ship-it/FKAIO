-- AGENT MEMORY - Store context and learnings for each agent
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  memory_type text NOT NULL DEFAULT 'context' CHECK (memory_type IN ('context', 'learning', 'preference', 'conversation', 'task_result')),
  content jsonb NOT NULL DEFAULT '{}',
  importance int DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_agent_memory" ON agent_memory FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_agent_memory" ON agent_memory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_agent_memory" ON agent_memory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_agent_memory" ON agent_memory FOR DELETE TO authenticated USING (true);

-- AGENT WORKFLOWS - Define automation workflows
CREATE TABLE IF NOT EXISTS agent_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'event', 'webhook', 'lead_created', 'stage_changed')),
  trigger_config jsonb DEFAULT '{}',
  steps jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count int DEFAULT 0,
  success_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_agent_workflows" ON agent_workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_agent_workflows" ON agent_workflows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_agent_workflows" ON agent_workflows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_agent_workflows" ON agent_workflows FOR DELETE TO authenticated USING (true);

-- AGENT OBJECTIVES - Track goals and KPIs per agent
CREATE TABLE IF NOT EXISTS agent_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  objective text NOT NULL,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text DEFAULT 'count',
  deadline timestamptz,
  priority int DEFAULT 50,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'paused')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_agent_objectives" ON agent_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_agent_objectives" ON agent_objectives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_agent_objectives" ON agent_objectives FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_agent_objectives" ON agent_objectives FOR DELETE TO authenticated USING (true);

-- AGENT ACTIVITY LOG - Real-time activity feed
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  lead_id uuid REFERENCES leads(id),
  job_id uuid REFERENCES ai_jobs(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_agent_activity" ON agent_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_agent_activity" ON agent_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- AGENT CONVERSATIONS - Store chat history with agents
CREATE TABLE IF NOT EXISTS agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  message text NOT NULL,
  response text,
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_conversations" ON agent_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_conversations" ON agent_conversations FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_agent ON agent_workflows(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_objectives_agent ON agent_objectives(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_created ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent ON agent_conversations(agent_id);

-- Add additional fields to ai_agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS personality text DEFAULT 'professional';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS total_tasks_completed int DEFAULT 0;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS success_rate numeric DEFAULT 0;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Seed objectives for existing agents
INSERT INTO agent_objectives (agent_id, objective, target_value, unit, priority, deadline)
SELECT 
  id,
  CASE 
    WHEN task = 'CAPTURE_LEADS' THEN 'Capture 50 new leads this month'
    WHEN task = 'QUALIFY_LEAD' THEN 'Qualify 100 leads with 80% accuracy'
    WHEN task = 'FOLLOW_UP' THEN 'Send 200 follow-ups with 30% response rate'
    WHEN task = 'SCHEDULE_MEETING' THEN 'Schedule 25 meetings this week'
    WHEN task = 'GENERATE_PROPOSAL' THEN 'Generate 15 proposals with 90% acceptance'
    WHEN task = 'CLOSE_DEAL' THEN 'Close 5 deals worth 50L this month'
    WHEN task = 'CREATE_CONTENT' THEN 'Create 20 content pieces this month'
    WHEN task = 'POST_SOCIAL' THEN 'Post 30 times with 5% engagement'
    WHEN task = 'RUN_ADS' THEN 'Achieve 500 leads at under INR 100 CPL'
    WHEN task = 'CREATE_VIDEO' THEN 'Create 10 videos with 10K views'
    WHEN task = 'SEO_OPTIMIZE' THEN 'Rank 10 keywords in top 10'
    WHEN task = 'ONBOARD_FRANCHISEE' THEN 'Onboard 5 franchisees this month'
    WHEN task = 'VERIFY_DOCS' THEN 'Verify 20 docs with 100% accuracy'
    WHEN task = 'COMPLIANCE_CHECK' THEN 'Check 15 franchises with 95% compliance'
    WHEN task = 'TRACK_COURIER' THEN 'Track 20 deliveries with 100% visibility'
    WHEN task = 'GENERATE_INVOICE' THEN 'Generate 30 invoices with zero errors'
    WHEN task = 'TRACK_ROYALTY' THEN 'Track 20 franchise royalties'
    WHEN task = 'CALCULATE_COMMISSION' THEN 'Calculate 10 consultant commissions'
    WHEN task = 'GENERATE_REPORT' THEN 'Generate 4 weekly reports'
    WHEN task = 'RECRUIT' THEN 'Screen 50 candidates, hire 3'
    WHEN task = 'TRAIN' THEN 'Train 10 consultants, 100% certification'
    WHEN task = 'EVALUATE' THEN 'Evaluate 5 consultants weekly'
    WHEN task = 'MAKE_DECISIONS' THEN 'Provide daily strategic insights'
    WHEN task = 'RESEARCH_TERRITORY' THEN 'Research 10 cities this month'
    WHEN task = 'BRAND_ANALYSIS' THEN 'Analyze 5 brands monthly'
    ELSE 'Achieve targets this month'
  END,
  CASE 
    WHEN task LIKE '%LEAD%' THEN 50
    WHEN task LIKE '%MEETING%' THEN 25
    WHEN task LIKE '%DEAL%' THEN 5
    WHEN task LIKE '%CONTENT%' THEN 20
    WHEN task LIKE '%REPORT%' THEN 4
    ELSE 10
  END,
  'count',
  70,
  NOW() + INTERVAL '30 days'
FROM ai_agents
ON CONFLICT DO NOTHING;