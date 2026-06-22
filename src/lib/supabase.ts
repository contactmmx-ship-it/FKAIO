import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// ============================================================
// Supabase Client — Production Configuration
// No demo data, no Proxy wrappers, no silent fallbacks.
// All errors propagate normally to callers.
// ============================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[FKAiOS] Missing required environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file. ' +
    'See .env.example for reference.'
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// ============================================================
// TypeScript Type Definitions
// ============================================================

export type User = {
  id: string;
  email: string;
  role?: string;
};

export type { Session };

/** @deprecated Use the re-exported `Session` from this module instead of importing from @supabase/supabase-js */

export type Brand = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  investment_range: string | null;
  royalty: string | null;
  sector: string | null;
  is_active: boolean;
  created_at: string;
};

export type Consultant = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
};

export type Lead = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  brand_id: string | null;
  assigned_to: string | null;
  investment_capacity: string | null;
  lead_score: number;
  stage: string;
  next_followup: string | null;
  notes: string | null;
  is_active: boolean;
  negotiation_status: string | null;
  last_objection: string | null;
  objections_count: number;
  negotiated_terms: string | null;
  deal_closure_date: string | null;
  created_at: string;
  brand?: Brand | null;
  consultant?: Consultant | null;
};

export type LeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type Meeting = {
  id: string;
  lead_id: string;
  consultant_id: string | null;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export type Document = {
  id: string;
  lead_id: string;
  type: string;
  status: string;
  url: string | null;
  file_url: string | null;
  file_size: number | null;
  version: number;
  notes: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  lead_id: string | null;
  type: string;
  amount: number;
  status: string;
  due_date: string | null;
  invoice_template: Record<string, unknown> | null;
  razorpay_order_id: string | null;
  generated_by: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string | null;
  status: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_gateway: string | null;
  payment_link: string | null;
  webhook_verified: boolean;
  paid_at: string | null;
  created_at: string;
};

export type AIAgent = {
  id: string;
  name: string;
  dept: string;
  task: string;
  description: string | null;
  prompt: string | null;
  tools: string[] | null;
  personality: string | null;
  avatar_url: string | null;
  total_tasks_completed: number;
  success_rate: number | null;
  last_active_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type AIJob = {
  id: string;
  agent_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  agent?: AIAgent | null;
};

export type AIOutcome = {
  id: string;
  job_id: string;
  outcome_type: string;
  outcome_data: Record<string, unknown>;
  confidence: number | null;
  created_at: string;
};

export type AIEvolution = {
  id: string;
  agent_id: string;
  evolution_type: string;
  description: string | null;
  metrics_before: Record<string, unknown> | null;
  metrics_after: Record<string, unknown> | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: 'franchise_fee' | 'training' | 'inventory' | 'tech_setup' | 'other' | null;
  created_at: string;
};

export type PaymentWebhook = {
  id: string;
  event_id: string | null;
  event_type: string | null;
  payment_id: string | null;
  payload: Record<string, unknown> | null;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
};

export type LeadObjection = {
  id: string;
  lead_id: string;
  objection_type: string | null;
  objection_text: string | null;
  ai_handler_response: string | null;
  outcome: 'resolved' | 'escalated' | 'pending' | null;
  created_at: string;
};

export type NegotiationHistory = {
  id: string;
  lead_id: string;
  change_type: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

export type AgentMemory = {
  id: string;
  agent_id: string;
  memory_type: 'context' | 'learning' | 'preference' | 'conversation' | 'task_result';
  content: Record<string, unknown>;
  importance: number;
  created_at: string;
  expires_at: string | null;
};

export type AgentWorkflow = {
  id: string;
  agent_id: string;
  name: string;
  trigger_type: 'manual' | 'scheduled' | 'event' | 'webhook' | 'lead_created' | 'stage_changed';
  trigger_config: Record<string, unknown>;
  steps: unknown[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  success_count: number;
  created_at: string;
};

export type AgentObjective = {
  id: string;
  agent_id: string;
  objective_text: string;
  target_metric: string;
  target_value: number | null;
  current_value: number;
  target_period: string;
  priority: number;
  status: 'active' | 'completed' | 'failed' | 'paused';
  created_at: string;
  updated_at: string;
};

export type AgentActivityLog = {
  id: string;
  agent_id: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  lead_id: string | null;
  job_id: string | null;
  created_at: string;
};

export type AgentConversation = {
  id: string;
  agent_id: string;
  user_id: string | null;
  message: string;
  response: string | null;
  context: Record<string, unknown>;
  created_at: string;
};

export type ConsultantBrand = {
  id: string;
  consultant_id: string;
  brand_id: string;
  assigned_at: string;
};

export type Setting = {
  id: string;
  key: string;
  value: string | null;
  updated_by: string | null;
  created_at: string;
};

// ============================================================
// Phase A — Project Registry Types
// ============================================================
export type ProjectRegistry = {
  id: string;
  project_name: string;
  project_slug: string;
  project_type: 'document' | 'module' | 'reference';
  source_location: string | null;
  description: string | null;
  brand_ids: string[] | null;
  migration_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retired';
  integration_status: 'not_started' | 'in_progress' | 'integrated' | 'failed';
  priority: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Phase B — Knowledge OS Types
// ============================================================
export type KnowledgeSource = {
  id: string;
  name: string;
  source_type: 'pdf' | 'docx' | 'txt' | 'markdown' | 'url' | 'manual';
  description: string | null;
  brand_id: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  document_count: number;
  status: 'active' | 'archived' | 'processing';
  created_at: string;
  updated_at: string;
};

export type KnowledgeDocument = {
  id: string;
  source_id: string;
  title: string;
  file_type: string;
  file_size: number | null;
  storage_path: string | null;
  raw_text: string | null;
  status: 'uploaded' | 'parsed' | 'chunked' | 'embedded' | 'failed';
  chunk_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Phase F — Accounting Types
// ============================================================
export type FinancialAccount = {
  id: string;
  account_name: string;
  account_type: 'bank' | 'cash' | 'upi' | 'wallet' | 'other';
  bank_name: string | null;
  account_number_last4: string | null;
  brand_id: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  financial_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  category: string | null;
  reference_number: string | null;
  invoice_id: string | null;
  lead_id: string | null;
  brand_id: string;
  is_reconciled: boolean;
  reconciled_with: string | null;
  source: 'manual' | 'csv_import' | 'bank_statement' | 'ai_classified' | 'auto';
  raw_data: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BankStatement = {
  id: string;
  financial_account_id: string;
  statement_month: string;
  file_type: 'csv' | 'pdf' | 'xlsx';
  storage_path: string | null;
  row_count: number | null;
  imported_count: number;
  duplicate_count: number;
  status: 'uploaded' | 'parsed' | 'importing' | 'completed' | 'failed';
  error_message: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type RevenueSnapshot = {
  id: string;
  brand_id: string;
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  franchise_fees_collected: number;
  royalties_collected: number;
  new_franchisees: number;
  active_franchisees: number;
  churned_franchisees: number;
  data: Record<string, unknown>;
  snapshot_type: 'monthly' | 'quarterly' | 'yearly';
  created_at: string;
};

// ============================================================
// Phase J — Governance Types
// ============================================================
export type ApprovalQueueItem = {
  id: string;
  action_type: 'refund' | 'contract' | 'payment' | 'legal' | 'pricing' | 'escalation' | 'ai_action' | 'data_export' | 'bulk_operation';
  entity_type: string;
  entity_id: string | null;
  request_data: Record<string, unknown>;
  requested_by_agent_id: string | null;
  requested_by_user_id: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved';
  threshold_rule: string | null;
  reviewer_id: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  expires_at: string;
  resolution_data: Record<string, unknown> | null;
  created_at: string;
};

// ============================================================
// Phase G — Founder Executive Types
// ============================================================
export type StrategicMilestone = {
  id: string;
  title: string;
  description: string | null;
  milestone_type: 'revenue' | 'expansion' | 'product' | 'team' | 'partnership' | 'operational';
  target_value: number | null;
  current_value: number;
  unit: string | null;
  baseline_date: string | null;
  target_date: string | null;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed' | 'cancelled';
  brand_id: string | null;
  progress_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FounderMemory = {
  id: string;
  category: 'preference' | 'decision' | 'context' | 'instruction' | 'relationship';
  key: string;
  value: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Phase I — Multi-Tenant Types
// ============================================================
export type Tenant = {
  id: string;
  tenant_name: string;
  tenant_slug: string;
  owner_id: string | null;
  plan: 'free' | 'starter' | 'growth' | 'enterprise' | 'custom';
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
  subscription_id: string | null;
  max_consultants: number;
  max_brands: number;
  max_leads: number;
  max_ai_jobs_monthly: number;
  features: Record<string, unknown>;
  settings: Record<string, unknown>;
  billing_email: string | null;
  billing_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
