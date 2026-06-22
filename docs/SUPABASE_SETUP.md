# Supabase Setup Guide

This guide walks you through setting up a fresh Supabase project for FKAiOS from scratch.

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- Your `.env` file configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- (Optional) [Supabase CLI](https://supabase.com/docs/guides/cli) installed for local development

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **"New Project"**.
3. Choose your organization (or create one).
4. Fill in:
   - **Name:** `fkaios-production` (or your preferred name)
   - **Database Password:** Generate a strong password and **save it securely**.
   - **Region:** Choose the closest to your users (e.g., `ap-south-1` Mumbai for India).
5. Click **"Create new project"** and wait for provisioning (~2 minutes).
6. Once ready, go to **Settings → API** and copy:
   - **Project URL** → paste into `VITE_SUPABASE_URL`
   - **anon public** key → paste into `VITE_SUPABASE_ANON_KEY`

---

## Step 2: Run Database Migrations

Open the **SQL Editor** in your Supabase Dashboard (left sidebar → SQL Editor). Run each migration file below **in exact order**. Click "Run" after pasting each one.

> **Important:** Do NOT skip any migration. Do NOT change the order. Each migration is idempotent (uses `IF NOT EXISTS` / `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`), so re-running is safe.

### Migration Order

| Order | File | What It Does |
|-------|------|-------------|
| 1 | `20260618111535_franchisee_kart_aios_schema.sql` | Creates 14 core tables, RLS policies, indexes, and seeds 5 brands + 25 AI agents |
| 2 | `20260618113146_create_ai_jobs_table.sql` | Creates `ai_jobs` table (no-op if migration #1 already ran) |
| 3 | `20260618143017_add_agent_memory_and_workflows.sql` | Creates 5 agent intelligence tables and seeds agent objectives |
| 4 | `20260619120000_phase0_security_rbac.sql` | Implements RBAC with role-scoped RLS policies and security helper functions |
| 5 | `20260620150000_phase2_invoices_payments.sql` | Adds `invoice_items`, `payment_webhooks` tables and Razorpay columns |
| 6 | `20260620160000_phase3_negotiation_tracking.sql` | Adds negotiation tracking, objection logging, and deal closure columns |
| 7 | `20260621000000_phase3_fix_missing_rls.sql` | Adds RLS policies for Phase 2/3 tables (critical — without this those tables are inaccessible) |
| 8 | `20260621010000_phase4_automation_triggers.sql` | Creates 5 automation triggers for auto-qualification, follow-ups, proposals, and invoicing |
| 9 | `20260621020000_phase6_document_storage.sql` | Creates the `documents` storage bucket and storage RLS policies |

### How to Run

For each migration file:
1. Open the file from `supabase/migrations/` in your text editor.
2. Copy **all** the SQL content.
3. Paste it into the Supabase SQL Editor.
4. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. Wait for "Success" confirmation before proceeding to the next.

---

## Step 3: Verify RLS Policies Are Active

After running all migrations, verify that Row Level Security is working correctly.

### Quick Verification Queries

Run these in the SQL Editor:

```sql
-- Check that RLS is enabled on key tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('leads', 'invoices', 'payments', 'ai_agents', 'ai_jobs', 'documents')
ORDER BY tablename;
-- All should show rowsecurity = true

-- Check policy count per table (should have policies, not zero)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- You should see many policies listed

-- Verify security helper functions exist
SELECT proname FROM pg_proc WHERE proname IN ('get_my_role', 'is_admin', 'my_brand_ids', 'get_my_consultant_id');
-- Should return 4 rows
```

### Expected RLS Behavior

- **Unauthenticated (anon) users:** Can only `SELECT` from `brands`. All other tables return empty results.
- **Authenticated users:** Access is scoped by role (Founder/OpsHead = full, RM = own leads only, Accounts = invoices/payments, etc.).
- **Service role key:** Bypasses all RLS (used by edge functions).

---

## Step 4: Create the 'documents' Storage Bucket

The Phase 6 migration attempts to create the storage bucket via SQL, but you should verify it exists in the dashboard.

### Via Dashboard

1. Go to **Storage** in the left sidebar.
2. Click **"New Bucket"**.
3. Set:
   - **Name:** `documents`
   - **Public:** OFF (private bucket)
   - **File size limit:** 10 MB (10,485,760 bytes)
4. Click **"Create bucket"**.

### Verify Storage Policies

1. Click on the `documents` bucket.
2. Go to the **Policies** tab.
3. You should see 4 policies:
   - `documents_read` — SELECT for authenticated users
   - `documents_insert` — INSERT for authenticated users
   - `documents_update` — UPDATE for authenticated users
   - `documents_delete` — DELETE for authenticated users

If these policies are missing (they should have been created by migration #9), run this SQL:

```sql
-- Only run if policies are missing
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

---

## Step 5: Set Edge Function Secrets

All edge function secrets are configured once and shared across all functions.

### Via Dashboard

1. Go to **Edge Functions** in the left sidebar.
2. Click the **"Secrets"** tab at the top.
3. Add each secret as a key-value pair:
4. Click **"Save"** after adding all secrets.

### Via CLI

```bash
# Set secrets one at a time
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
supabase secrets set OPENAI_API_KEY=your-openai-key
supabase secrets set WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your-phone-id
supabase secrets set META_ACCESS_TOKEN=your-meta-token
supabase secrets set META_WEBHOOK_VERIFY_TOKEN=your-meta-verify-token
supabase secrets set LINKEDIN_WEBHOOK_VERIFY_TOKEN=your-linkedin-token
supabase secrets set RAZORPAY_KEY_ID=your-razorpay-key-id
supabase secrets set RAZORPAY_KEY_SECRET=your-razorpay-secret
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
supabase secrets set GOOGLE_CALENDAR_API_KEY=your-google-calendar-key
supabase secrets set GOOGLE_CALENDAR_ID=your-calendar-id
supabase secrets set CRM_WEBHOOK_SECRET=your-crm-webhook-secret
```

### Minimum Required Secrets for Basic Operation

For the app to function at all (without AI, payments, or webhooks), you only need:
- `SUPABASE_SERVICE_ROLE_KEY`

For AI features to work, add:
- `ANTHROPIC_API_KEY`

Other secrets can be added later as you enable specific features.

---

## Step 6: Deploy Edge Functions

### Via Dashboard (Recommended for First-Time)

1. Go to **Edge Functions** in the left sidebar.
2. For each function directory in `supabase/functions/`:
   - Click **"New Function"**
   - Enter the function name (e.g., `ai-engine`)
   - Replace the default code with the contents of the function's `index.ts`
   - Click **"Deploy"**

### Via CLI (Recommended for Iterative Development)

```bash
# Deploy all functions at once
supabase functions deploy

# Deploy a single function
supabase functions deploy ai-engine
supabase functions deploy whatsapp-webhook
supabase functions deploy payment-engine
# ... deploy all 15 functions
```

### Functions to Deploy (in any order)

1. `ai-engine` — Core AI execution
2. `job-scheduler` — Job queue processor
3. `closer-engine` — Deal closing AI
4. `meeting-scheduler` — Calendar integration
5. `invoice-pdf` — Invoice rendering
6. `payment-engine` — Payment processing
7. `payment-link` — Payment link generation
8. `document-engine` — Document management
9. `whatsapp-webhook` — WhatsApp integration
10. `meta-webhook` — Meta Lead Ads
11. `linkedin-webhook` — LinkedIn leads
12. `crm-webhook` — Generic CRM webhook
13. `ops-intelligence` — Pipeline analytics
14. `reporting-engine` — Strategic reports
15. `mis-engine` — MIS report generation

### Verify Deployment

After deploying, verify each function is listed in **Edge Functions** and shows a green "Active" status. You can test a simple function:

```bash
# Test the mis-engine (no special auth needed beyond anon)
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/mis-engine?action=daily_briefing
```

---

## Step 7: Verify Seed Data

After all migrations, verify the seed data was inserted correctly.

### Check Brands

```sql
SELECT id, name, slug, type, sector FROM brands ORDER BY name;
```

Expected: 5 rows — Franchisee Kart, Turning Points, Chaat Masters, Arofur, Chawla Laboratory.

### Check AI Agents

```sql
SELECT name, dept, task, is_active FROM ai_agents ORDER BY dept, task;
```

Expected: 25 rows across departments SALES (6), MARKETING (5), OPERATIONS (4), FINANCE (4), HR (3), STRATEGY (3).

### Check Agent Objectives

```sql
SELECT a.name, o.objective, o.target_value, o.unit
FROM agent_objectives o
JOIN ai_agents a ON a.id = o.agent_id
ORDER BY a.dept, a.name;
```

Expected: 25 rows — one objective per agent.

### Check Auth Trigger

```sql
SELECT tgname, tgrelid::regclass, tgtype
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

Expected: 1 row — the trigger that auto-links new auth users to consultant rows.

### Check Automation Triggers

```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE 'trg_auto_%';
```

Expected: 5 rows — `trg_auto_qualify_new_lead`, `trg_auto_followup_stage_change`, `trg_auto_schedule_meeting`, `trg_auto_generate_proposal`, `trg_auto_invoice_onboarding`.

---

## Troubleshooting

### "Migration failed" errors

- Migrations use `IF NOT EXISTS` throughout. If you see an error, it's likely a syntax issue or a pre-existing conflict. Read the error message carefully.
- You can safely re-run any migration — they are designed to be idempotent.

### RLS returning empty results for authenticated users

- Check that the user has a matching `consultants` row with `auth_user_id` set.
- Run: `SELECT * FROM consultants WHERE email = 'user@example.com';`
- If missing, the auth trigger should auto-create it on next login. If not, manually insert a consultant row.

### Edge functions returning 500 errors

- Check that `SUPABASE_SERVICE_ROLE_KEY` is set as a secret.
- Check function logs in Supabase Dashboard → Edge Functions → click function → **Logs** tab.
- Verify that the function code matches the latest version in the repository.

### Storage uploads failing

- Verify the `documents` bucket exists (Storage → should show "documents").
- Verify storage RLS policies are in place (Storage → documents → Policies).
- Check that the file size is under 10 MB and MIME type is in the allowed list.