# FKAiOS Phase 2/3 Bugfix Report

**Date:** 2026-06-21  
**Scope:** Fix all column mismatches, dynamic Tailwind, missing RLS, and type definitions

---

## BUG 1: Leads.tsx — Form field mismatch

**File:** `src/pages/Leads.tsx`

**Problems:**
- Form state initialized with keys `company_name`, `contact_name`, `contact_phone`, `contact_email`, `location`, `lead_source` — none of which match the DB columns (`name`, `mobile`, `email`, `city`, `state`, `source`)
- The form inputs bound to `form.name`, `form.mobile`, etc. but the initial values had those keys empty/missing
- Filter on line 139 used `l.lead_source` instead of `l.source`
- Source dropdown in the form had hardcoded values (Website, WhatsApp, Facebook, IndiaMart, etc.) that didn't match the `leadSources` array (Manual Entry, WhatsApp, Meta Lead Ads, LinkedIn Lead Gen, Website Form, Referral)
- Kanban card badge used `lead.lead_source` instead of `lead.source`

**Fixes:**
- Changed form state initial values to: `name`, `mobile`, `email`, `city`, `state`, `source` (matching DB)
- Changed form reset after successful insert to use the same keys
- Fixed filter: `l.lead_source` → `l.source`
- Fixed source dropdown to iterate over `leadSources` array instead of hardcoded options
- Fixed kanban card badge: `lead.lead_source` → `lead.source`

---

## BUG 2: Dashboard.tsx — Pipeline counts wrong + dynamic Tailwind

**File:** `src/pages/Dashboard.tsx`

**Problems:**
- Pipeline snapshot counts were calculated from `recentLeads` (first 5 leads only) instead of all leads
- Dynamic Tailwind classes `bg-${kpi.color}-500/20` and `text-${kpi.color}-400` are purged at build time and produce no styling
- Hardcoded "25 Agents Active" text instead of actual agent count
- Hardcoded trend values (12%, 8%, 15%, 2%) with no backing data

**Fixes:**
- Added `allLeads` state that stores the full leads array; pipeline snapshot now counts from `allLeads`
- Created `kpiColorMap` static object mapping color names to Tailwind class strings
- Replaced dynamic `bg-${kpi.color}-500/20` with `colorClasses.bg` and `text-${kpi.color}-400` with `colorClasses.text`
- Removed hardcoded trend indicators (ArrowUpRight/ArrowDownRight + trendValue) from KPI cards — no historical data exists to calculate trends
- Changed "25 Agents Active" to `{stats?.active_agents_count ?? 0} Agents Active` using actual `agents.length`

---

## BUG 3: LeadDetail.tsx — saveLead sends join objects + meeting date

**File:** `src/pages/LeadDetail.tsx`

**Problems:**
- `saveLead()` sent the entire `form` object (including `brand` and `consultant` join objects from the Supabase select) back as an update, causing a 400 error
- `addMeeting()` hardcoded `Date.now() + 86400000` (tomorrow) with no way for the user to choose a date/time

**Fixes:**
- `saveLead()` now destructures: `const { brand, consultant, created_at, ...updateData } = form;` and sends only `updateData`
- `addMeeting()` replaced with a toggle form showing a `datetime-local` input. The user picks a date/time, clicks "Confirm" to schedule. Added `meetingDate` and `showMeetingForm` state variables

---

## BUG 4: AIJobs.tsx — Dynamic Tailwind + batch count

**File:** `src/pages/AIJobs.tsx`

**Problems:**
- Dynamic Tailwind classes `text-${stat.color}-400` in stats section are purged at build time
- `runBatchJobs()` blindly subtracted 10 from `remaining` after each batch instead of re-checking actual count

**Fixes:**
- Created `statColorMap` static object mapping color names to Tailwind class strings
- Replaced dynamic template strings with `statColorMap[stat.color]` lookups
- `runBatchJobs()` now re-queries `supabase.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending')` after each batch to get the true remaining count

---

## BUG 5: Meetings.tsx — Shows UUID instead of consultant name

**File:** `src/pages/Meetings.tsx`

**Problems:**
- The query `select('*, lead:lead_id(name, city, mobile)')` did not join the consultant table
- The card displayed `meeting.consultant_id` (a raw UUID) instead of the consultant's name

**Fixes:**
- Changed select to: `select('*, lead:lead_id(name, city, mobile), consultant:consultant_id(id, name)')`
- Changed display from `{meeting.consultant_id || 'Unassigned'}` to `{meeting.consultant?.name || 'Unassigned'}`

---

## BUG 6: Edge function column mismatches

### closer-engine/index.ts
- `lead.contact_name` → `lead.name`
- `lead.contact_email` → `lead.email`
- `lead.contact_phone` → `lead.mobile`
- `lead.company_name` → removed (no such column; uses `lead.name`)
- `stage: "closed"` → `stage: "Onboarded"` (closed is not in the leads stage CHECK constraint)
- Agent search `"Invoice Generator"` → `"Invoice AI"` (matches seed data)
- `activity_type: "note"` → `type: "note"` (correct column in lead_activities)
- `description: ...` → `note: ...` (correct column in lead_activities)

### mis-engine/index.ts
- `lead.lead_source` → `lead.source` (correct DB column)
- `p.status === "completed"` → `p.status === "Confirmed"` (CHECK constraint: Pending/Confirmed/Failed)
- `i.status !== "paid" && i.status !== "cancelled"` → `i.status === "Pending" || i.status === "Overdue"` (CHECK constraint: Pending/Paid/Overdue)
- `agents.status === "active"` → `agents.is_active === true` (correct column)
- `m.meeting_date` → `m.scheduled_at` (correct column in meetings table)
- Added `agent_id: null` to agent_activity_log insert (column can be nullable)

### meeting-scheduler/index.ts
- Insert into meetings removed non-existent columns: `title`, `description`, `meeting_date`, `duration_minutes`
- Insert now uses only valid columns: `lead_id`, `consultant_id`, `scheduled_at`, `status`, `notes`
- `lead.company_name` → `lead.name`
- `lead.contact_name` → `lead.name`
- WhatsApp URL `graph.instagram.com` → `graph.facebook.com`
- `meeting_date` → `scheduled_at` in confirm_slot update
- `meeting.title` / `meeting.description` → derived values from meeting_id and notes
- `activity_type` → `type` in lead_activities inserts

### ops-intelligence/index.ts
- `lead.updated_at` → removed (column doesn't exist in leads table). Duration calculation set to 0 with a comment explaining why
- `brand.status === "active"` → `brand.is_active === true`
- `agents.status === "active"` → `agents.is_active === true`

### payment-engine/index.ts
- `status: "draft"` → `status: "Pending"` (CHECK constraint: Pending/Paid/Overdue)
- Removed `invoice_number` and `currency` and `notes` from insert (don't exist in invoices table)
- Added `type: "Registration Fee"` (required column)
- Webhook routing: changed from `/payment-webhook` path check to `payment-engine` path + `invoice_id` query param check
- Added `action: "handle_webhook"` as explicit action option
- Removed non-existent payment columns: `payment_method`, `transaction_id`, `payment_gateway` (duplicated Phase 2 columns)
- Payment status `"completed"` → `"Confirmed"` (CHECK constraint)

---

## BUG 7: Missing RLS policies

**New file:** `supabase/migrations/20260621000000_phase3_fix_missing_rls.sql`

**Tables affected:**
- `invoice_items` — RLS was enabled but had zero policies
- `payment_webhooks` — RLS was enabled but had zero policies
- `lead_objections` — RLS was enabled but had zero policies
- `negotiation_history` — RLS was enabled but had zero policies

**Policies added:**
- All tables follow the same role+brand scoped pattern from Phase 0
- `invoice_items`: Admin + Accounts full; scoped via parent invoice → lead
- `payment_webhooks`: Admin + Accounts full access
- `lead_objections`: Admin full; RM/BrandManager scoped via parent lead
- `negotiation_history`: Admin full; RM/BrandManager scoped via parent lead

---

## BUG 8: Duplicate ai_jobs migration

**File:** `supabase/migrations/20260618111535_franchisee_kart_aios_schema.sql`

**Issue:** Migration `20260618113146_create_ai_jobs_table.sql` creates `ai_jobs` with `CREATE TABLE IF NOT EXISTS`, duplicating the table already defined in the main schema migration. The duplicate has a different column set (missing `agent_id` and `error`, has extra `updated_at`).

**Resolution:** Added a NOTE comment to the main schema migration documenting the duplicate. Both files preserved as-is (the `IF NOT EXISTS` prevents errors, and Phase 0 migration adds the missing columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

---

## BUG 9: Missing TypeScript types in supabase.ts

**File:** `src/lib/supabase.ts`

**Added types:**
- `InvoiceItem` — matches `invoice_items` table (id, invoice_id, item_name, description, quantity, unit_price, total, item_type, created_at)
- `PaymentWebhook` — matches `payment_webhooks` table (id, event_id, event_type, payment_id, payload, processed, processed_at, created_at)
- `LeadObjection` — matches `lead_objections` table (id, lead_id, objection_type, objection_text, ai_handler_response, outcome, created_at)
- `NegotiationHistory` — matches `negotiation_history` table (id, lead_id, change_type, field_name, old_value, new_value, changed_by, change_reason, created_at)
- `AgentMemory` — matches `agent_memory` table (id, agent_id, memory_type, content, importance, created_at, expires_at)
- `AgentWorkflow` — matches `agent_workflows` table (id, agent_id, name, trigger_type, trigger_config, steps, is_active, last_run_at, next_run_at, run_count, success_count, created_at)
- `AgentObjective` — matches `agent_objectives` table (id, agent_id, objective, target_value, current_value, unit, deadline, priority, status, created_at, updated_at)
- `AgentActivityLog` — matches `agent_activity_log` table (id, agent_id, activity_type, title, description, metadata, lead_id, job_id, created_at)
- `AgentConversation` — matches `agent_conversations` table (id, agent_id, user_id, message, response, context, created_at)

---

## Files Modified

| File | Bug |
|------|-----|
| `src/pages/Leads.tsx` | 1 |
| `src/pages/Dashboard.tsx` | 2 |
| `src/pages/LeadDetail.tsx` | 3 |
| `src/pages/AIJobs.tsx` | 4 |
| `src/pages/Meetings.tsx` | 5 |
| `supabase/functions/closer-engine/index.ts` | 6 |
| `supabase/functions/mis-engine/index.ts` | 6 |
| `supabase/functions/meeting-scheduler/index.ts` | 6 |
| `supabase/functions/ops-intelligence/index.ts` | 6 |
| `supabase/functions/payment-engine/index.ts` | 6 |
| `supabase/migrations/20260618111535_franchisee_kart_aios_schema.sql` | 8 |
| `src/lib/supabase.ts` | 9 |

## Files Created

| File | Bug |
|------|-----|
| `supabase/migrations/20260621000000_phase3_fix_missing_rls.sql` | 7 |
| `PHASE2_BUGFIX_REPORT.md` | Report |