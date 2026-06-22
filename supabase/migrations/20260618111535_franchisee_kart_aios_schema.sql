/*
# Franchisee Kart AIOS - Full Production Schema

1. New Tables - brands, consultants, leads, lead_activities, meetings, documents,
   invoices, payments, ai_agents, ai_jobs, ai_outcomes, ai_evolution, notifications, settings

2. Security - RLS enabled on all tables with authenticated or anon policies

3. Indexes for performance queries

NOTE (Bugfix 2026-06-21): There is a DUPLICATE ai_jobs table creation in migration
20260618113146_create_ai_jobs_table.sql. That migration uses CREATE TABLE IF NOT EXISTS
so it silently skips. However, it has a different column set (missing agent_id, error columns;
has an extra updated_at column). The Phase 0 security_rbac migration later adds the missing
columns via ALTER TABLE ... ADD COLUMN IF NOT EXISTS. Both files are preserved as-is; no
deletion was performed.

4. Seed data for brands and 25 AI agents
*/

-- BRANDS
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'franchise',
  description text,
  investment_range text,
  royalty text,
  sector text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_brands" ON brands;
CREATE POLICY "select_brands" ON brands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_brands" ON brands;
CREATE POLICY "insert_brands" ON brands FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_brands" ON brands;
CREATE POLICY "update_brands" ON brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_brands" ON brands;
CREATE POLICY "delete_brands" ON brands FOR DELETE TO authenticated USING (true);

-- CONSULTANTS
CREATE TABLE IF NOT EXISTS consultants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'RM' CHECK (role IN ('Founder','OpsHead','RM','Accounts','BrandManager','Trainer')),
  department text DEFAULT 'SALES',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_consultants" ON consultants;
CREATE POLICY "select_consultants" ON consultants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_consultants" ON consultants;
CREATE POLICY "insert_consultants" ON consultants FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_consultants" ON consultants;
CREATE POLICY "update_consultants" ON consultants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_consultants" ON consultants;
CREATE POLICY "delete_consultants" ON consultants FOR DELETE TO authenticated USING (true);

-- LEADS
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text,
  email text,
  city text,
  state text,
  source text DEFAULT 'Website',
  brand_id uuid REFERENCES brands(id),
  assigned_to uuid REFERENCES consultants(id),
  investment_capacity text,
  lead_score int DEFAULT 0,
  stage text NOT NULL DEFAULT 'Inquiry' CHECK (stage IN ('Inquiry','Contacted','Qualified','Meeting Scheduled','Proposal Sent','Negotiation','Registration Fee','Agreement','Onboarding Fee','Onboarded','Lost')),
  next_followup timestamptz,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_leads" ON leads;
CREATE POLICY "select_leads" ON leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_leads" ON leads;
CREATE POLICY "insert_leads" ON leads FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_leads" ON leads;
CREATE POLICY "update_leads" ON leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_leads" ON leads;
CREATE POLICY "delete_leads" ON leads FOR DELETE TO authenticated USING (true);

-- LEAD ACTIVITIES
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  note text,
  created_by uuid REFERENCES consultants(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_lead_activities" ON lead_activities;
CREATE POLICY "select_lead_activities" ON lead_activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_lead_activities" ON lead_activities;
CREATE POLICY "insert_lead_activities" ON lead_activities FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_lead_activities" ON lead_activities;
CREATE POLICY "update_lead_activities" ON lead_activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_lead_activities" ON lead_activities;
CREATE POLICY "delete_lead_activities" ON lead_activities FOR DELETE TO authenticated USING (true);

-- MEETINGS
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  consultant_id uuid REFERENCES consultants(id),
  scheduled_at timestamptz,
  status text DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Completed','Cancelled','No Show')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_meetings" ON meetings;
CREATE POLICY "select_meetings" ON meetings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_meetings" ON meetings;
CREATE POLICY "insert_meetings" ON meetings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_meetings" ON meetings;
CREATE POLICY "update_meetings" ON meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_meetings" ON meetings;
CREATE POLICY "delete_meetings" ON meetings FOR DELETE TO authenticated USING (true);

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Rejected')),
  url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_documents" ON documents;
CREATE POLICY "select_documents" ON documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_documents" ON documents;
CREATE POLICY "insert_documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_documents" ON documents;
CREATE POLICY "update_documents" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_documents" ON documents;
CREATE POLICY "delete_documents" ON documents FOR DELETE TO authenticated USING (true);

-- INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Overdue')),
  due_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoices" ON invoices;
CREATE POLICY "select_invoices" ON invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_invoices" ON invoices;
CREATE POLICY "insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_invoices" ON invoices;
CREATE POLICY "update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_invoices" ON invoices;
CREATE POLICY "delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  invoice_id uuid REFERENCES invoices(id),
  amount numeric NOT NULL DEFAULT 0,
  method text,
  status text DEFAULT 'Confirmed' CHECK (status IN ('Pending','Confirmed','Failed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payments" ON payments;
CREATE POLICY "select_payments" ON payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_payments" ON payments;
CREATE POLICY "update_payments" ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_payments" ON payments;
CREATE POLICY "delete_payments" ON payments FOR DELETE TO authenticated USING (true);

-- AI AGENTS
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dept text NOT NULL,
  task text NOT NULL,
  description text,
  prompt text,
  tools jsonb DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_agents" ON ai_agents;
CREATE POLICY "select_ai_agents" ON ai_agents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_agents" ON ai_agents;
CREATE POLICY "insert_ai_agents" ON ai_agents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_agents" ON ai_agents;
CREATE POLICY "update_ai_agents" ON ai_agents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_agents" ON ai_agents;
CREATE POLICY "delete_ai_agents" ON ai_agents FOR DELETE TO authenticated USING (true);

-- AI JOBS
CREATE TABLE IF NOT EXISTS ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id),
  type text NOT NULL,
  payload jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','retry')),
  retry_count int DEFAULT 0,
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_jobs" ON ai_jobs;
CREATE POLICY "select_ai_jobs" ON ai_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_jobs" ON ai_jobs;
CREATE POLICY "insert_ai_jobs" ON ai_jobs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_jobs" ON ai_jobs;
CREATE POLICY "update_ai_jobs" ON ai_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_jobs" ON ai_jobs;
CREATE POLICY "delete_ai_jobs" ON ai_jobs FOR DELETE TO authenticated USING (true);

-- AI OUTCOMES
CREATE TABLE IF NOT EXISTS ai_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES ai_jobs(id),
  agent_name text,
  action_type text,
  success boolean DEFAULT false,
  metric_score int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_outcomes" ON ai_outcomes;
CREATE POLICY "select_ai_outcomes" ON ai_outcomes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_outcomes" ON ai_outcomes;
CREATE POLICY "insert_ai_outcomes" ON ai_outcomes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_outcomes" ON ai_outcomes;
CREATE POLICY "update_ai_outcomes" ON ai_outcomes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_outcomes" ON ai_outcomes;
CREATE POLICY "delete_ai_outcomes" ON ai_outcomes FOR DELETE TO authenticated USING (true);

-- AI EVOLUTION
CREATE TABLE IF NOT EXISTS ai_evolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  old_prompt text,
  new_prompt text,
  reason text,
  performance_gain int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_evolution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_evolution" ON ai_evolution;
CREATE POLICY "select_ai_evolution" ON ai_evolution FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_evolution" ON ai_evolution;
CREATE POLICY "insert_ai_evolution" ON ai_evolution FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_evolution" ON ai_evolution;
CREATE POLICY "update_ai_evolution" ON ai_evolution FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_evolution" ON ai_evolution;
CREATE POLICY "delete_ai_evolution" ON ai_evolution FOR DELETE TO authenticated USING (true);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_settings" ON settings;
CREATE POLICY "insert_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_settings" ON settings;
CREATE POLICY "update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_settings" ON settings;
CREATE POLICY "delete_settings" ON settings FOR DELETE TO authenticated USING (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_brand ON leads(brand_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_documents_lead ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lead ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_lead ON payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_agent ON ai_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_dept ON ai_agents(dept);
CREATE INDEX IF NOT EXISTS idx_consultants_role ON consultants(role);

-- SEED BRANDS
INSERT INTO brands (name, slug, type, description, investment_range, royalty, sector)
VALUES
  ('Franchisee Kart', 'franchisee-kart', 'consulting', 'Leading franchise consulting platform', '5L - 50L', '5-15%', 'Consulting'),
  ('Turning Points', 'turning-points', 'visa', 'Study Visa & Immigration Services', '50K - 2L', '10%', 'Immigration'),
  ('Chaat Masters', 'chaat-masters', 'franchise', 'QSR Franchise Chain', '10L - 30L', '8%', 'QSR'),
  ('Arofur', 'arofur', 'franchise', 'Premium Furniture Franchise', '20L - 1Cr', '6%', 'Furniture'),
  ('Chawla Laboratory', 'chawla-lab', 'franchise', 'Diagnostic & Healthcare Franchise', '15L - 40L', '10%', 'Healthcare')
ON CONFLICT (slug) DO NOTHING;

-- SEED AI AGENTS
INSERT INTO ai_agents (name, dept, task, description, prompt)
VALUES
  ('Lead Hunter AI', 'SALES', 'CAPTURE_LEADS', 'Captures leads from all inbound channels', 'You are a Lead Hunter AI for Franchisee Kart. Capture and classify incoming leads from website, WhatsApp, and social media. Extract: name, mobile, city, investment capacity, brand interest. Return structured JSON.'),
  ('Lead Qualifier AI', 'SALES', 'QUALIFY_LEAD', 'Scores and qualifies leads based on budget and timeline', 'You are a Lead Qualifier AI. Score leads 0-100: investment capacity (40pts), location demand (20pts), timeline urgency (20pts), brand fit (20pts). Output: {score, stage, hot_lead, recommended_action, notes}'),
  ('Follow-up AI', 'SALES', 'FOLLOW_UP', 'Automates follow-up sequences via WhatsApp/email', 'You are a Follow-up AI. Generate personalized follow-up messages. Vary tone based on lead score and last interaction. Output: {channel, message, followup_after_hours, priority}'),
  ('Meeting Scheduler AI', 'SALES', 'SCHEDULE_MEETING', 'Books and manages consultant meetings', 'You are a Meeting Scheduler AI. Find optimal meeting slots, generate Zoom links, send confirmation messages. Output: {scheduled_at, zoom_link, confirmation_message, reminder_message}'),
  ('Proposal AI', 'SALES', 'GENERATE_PROPOSAL', 'Creates franchise proposals with ROI calculations', 'You are a Proposal AI for Franchisee Kart. Generate detailed franchise proposals including: investment breakdown, ROI projection (3-5 years), territory analysis, support structure. Format as professional document content.'),
  ('Closer AI', 'SALES', 'CLOSE_DEAL', 'Handles deal closing and negotiation logic', 'You are a Closing AI. Analyze deal readiness score, handle common objections, suggest pricing strategy. Output: {close_probability, objection_handling, next_action, discount_suggestion}'),
  ('Content AI', 'MARKETING', 'CREATE_CONTENT', 'Creates blogs, landing pages, email sequences', 'You are a Content AI for Franchisee Kart. Write SEO-optimized franchise content: blogs, landing pages, email sequences. Use conversion-focused copywriting. Brand voice: professional, trustworthy, growth-focused.'),
  ('Social Media AI', 'MARKETING', 'POST_SOCIAL', 'Manages daily social media across all platforms', 'You are a Social Media AI. Create daily posts for Instagram, LinkedIn, Facebook. Generate: caption, 5 hashtags, post timing, story variant. Content pillars: success stories, brand showcases, investment tips.'),
  ('Ad Campaign AI', 'MARKETING', 'RUN_ADS', 'Manages Meta and Google Ads optimization', 'You are an Ad Campaign AI. Analyze ad performance metrics, suggest budget allocation, generate ad copy variants, optimize targeting for franchise leads in India.'),
  ('Video AI', 'MARKETING', 'CREATE_VIDEO', 'Creates franchise videos and reels scripts', 'You are a Video Content AI. Generate video scripts, storyboards, and reels concepts for franchise promotion. Format: {title, hook_line, script, cta, visual_notes}'),
  ('SEO AI', 'MARKETING', 'SEO_OPTIMIZE', 'Manages SEO strategy and keyword rankings', 'You are an SEO AI. Research high-intent franchise keywords, generate on-page optimization recommendations, track rankings. Output: {keywords, meta_title, meta_desc, content_recommendations}'),
  ('Onboarding AI', 'OPERATIONS', 'ONBOARD_FRANCHISEE', 'Handles complete franchise onboarding workflow', 'You are an Onboarding AI. Manage 10-step onboarding: KYC verification, agreement signing, fee collection, brand training, operational setup, launch support. Track progress and escalate blockers.'),
  ('Documentation AI', 'OPERATIONS', 'VERIFY_DOCS', 'Verifies KYC, agreements, and compliance documents', 'You are a Documentation AI. Verify uploaded documents for completeness and validity. Check: KYC fields, agreement clauses, compliance signatures. Output: {status, missing_items, risk_flags, action_required}'),
  ('Compliance AI', 'OPERATIONS', 'COMPLIANCE_CHECK', 'Monitors brand compliance and renewal alerts', 'You are a Compliance AI. Monitor franchise compliance against brand standards, track agreement renewal dates, generate compliance scorecards. Alert for violations and upcoming renewals.'),
  ('Courier AI', 'OPERATIONS', 'TRACK_COURIER', 'Manages franchise kit delivery tracking', 'You are a Courier AI. Track franchise starter kit deliveries across 10 stages. Send proactive delivery updates, handle exceptions, confirm receipt. Integrate with courier APIs.'),
  ('Invoice AI', 'FINANCE', 'GENERATE_INVOICE', 'Creates GST-compliant invoices', 'You are an Invoice AI. Generate GST-compliant invoices for: registration fees, onboarding fees, royalties, training fees. Include: GSTIN, HSN codes, tax breakdowns, payment terms.'),
  ('Royalty AI', 'FINANCE', 'TRACK_ROYALTY', 'Calculates and tracks franchise royalties', 'You are a Royalty AI. Calculate monthly royalties based on franchisee revenue, send payment reminders at D-7, D-3, D-0, escalate overdue to Founder. Generate royalty P&L by brand.'),
  ('Commission AI', 'FINANCE', 'CALCULATE_COMMISSION', 'Manages consultant commission calculations', 'You are a Commission AI. Calculate franchise consultant payouts based on: deal value, brand tier, closure speed. Apply referral multipliers. Generate commission statements monthly.'),
  ('MIS AI', 'FINANCE', 'GENERATE_REPORT', 'Generates dashboards and KPI reports', 'You are an MIS AI. Generate: daily lead pipeline summary, weekly revenue forecast, monthly P&L by brand, quarterly growth analysis. Format as founder-ready executive briefings.'),
  ('Recruitment AI', 'HR', 'RECRUIT', 'Screens candidates and manages hiring pipeline', 'You are a Recruitment AI. Screen franchise consultant resumes: score communication skills (30), sales experience (40), franchise knowledge (30). Rank and schedule top candidates.'),
  ('Training AI', 'HR', 'TRAIN', 'Delivers SOPs and manages certification', 'You are a Training AI. Deliver structured SOPs, quizzes, and certifications via LMS. Track completion rates, identify knowledge gaps, recommend refresher training.'),
  ('Performance AI', 'HR', 'EVALUATE', 'Monitors KPIs and calculates incentives', 'You are a Performance AI. Monitor: leads closed, conversion rate, revenue generated, client satisfaction per consultant. Generate monthly scorecards and incentive calculations.'),
  ('CEO AI', 'STRATEGY', 'MAKE_DECISIONS', 'Strategic decision intelligence for the Founder', 'You are the CEO AI for Franchisee Kart. Daily tasks: analyze all KPIs, identify top 3 risks, recommend 3 growth actions, flag underperforming agents, generate founder morning briefing. Output: {health_score, risks, recommendations, agent_alerts, briefing}'),
  ('Territory AI', 'STRATEGY', 'RESEARCH_TERRITORY', 'Analyzes franchise territory expansion potential', 'You are a Territory AI. Analyze Indian cities for franchise viability: population, competition, purchasing power, industry presence. Rank territories for each brand. Output: {city, viability_score, competition_level, recommended_brands}'),
  ('Brand AI', 'STRATEGY', 'BRAND_ANALYSIS', 'Analyzes brand performance and expansion strategy', 'You are a Brand Analysis AI. Track brand KPIs: franchisee count, revenue, NPS, compliance score. Generate expansion recommendations and franchise offer optimization reports.')
ON CONFLICT DO NOTHING;
