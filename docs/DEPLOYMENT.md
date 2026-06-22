# Production Deployment Guide

This guide covers deploying FKAiOS to production using Vercel (frontend) and Supabase (backend).

---

## 1. Frontend Deployment (Vercel)

Vercel is the recommended hosting platform for Vite + React applications. It provides automatic HTTPS, CDN, preview deployments, and zero-config builds.

### 1.1 Connect GitHub Repository

1. Push your code to a GitHub repository (private recommended).
2. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
3. Click **"Add New" → "Project"**.
4. Select the `fkaios-production` repository.
5. Configure the project:
   - **Framework Preset:** Vite (auto-detected)
   - **Root Directory:** `.` (root)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. Click **"Deploy"**.

### 1.2 Set Environment Variables in Vercel

After the first deployment (it may fail without env vars), configure environment variables:

1. Go to your project → **Settings** → **Environment Variables**.
2. Add these variables (apply to **Production**, **Preview**, and **Development**):

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your production Supabase URL (e.g., `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your production Supabase anon key |

3. Click **"Save"**.
4. Go to **Deployments** → click the latest deployment → **Redeploy**.

### 1.3 Custom Domain (Optional)

1. Go to **Settings** → **Domains**.
2. Add your domain (e.g., `app.franchiseekart.com`).
3. Configure DNS records as instructed by Vercel:
   - **A Record:** `76.76.21.21` (or CNAME to `cname.vercel-dns.com`)
4. Vercel will automatically provision an SSL certificate.

### 1.4 Verify Frontend Deployment

- Visit your Vercel URL.
- You should see the login page.
- Try signing in with a Supabase auth user.
- Verify the dashboard loads with real data.

---

## 2. Supabase Production Checklist

Ensure your Supabase project is fully configured for production.

### 2.1 All Migrations Applied

- [ ] All 9 migrations run successfully (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md#step-2-run-database-migrations))
- [ ] No errors in the SQL Editor output for any migration
- [ ] Seed data verified: 5 brands, 25 AI agents, 25 agent objectives

### 2.2 All Secrets Configured

Go to **Edge Functions → Secrets** and verify:

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `OPENAI_API_KEY` (optional fallback)
- [ ] `WHATSAPP_ACCESS_TOKEN` (if using WhatsApp)
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (if using WhatsApp)
- [ ] `WHATSAPP_PHONE_NUMBER_ID` (if using WhatsApp)
- [ ] `META_ACCESS_TOKEN` (if using Meta Lead Ads)
- [ ] `META_WEBHOOK_VERIFY_TOKEN` (if using Meta Lead Ads)
- [ ] `LINKEDIN_WEBHOOK_VERIFY_TOKEN` (if using LinkedIn)
- [ ] `RAZORPAY_KEY_ID` (if using payments)
- [ ] `RAZORPAY_KEY_SECRET` (if using payments)
- [ ] `RAZORPAY_WEBHOOK_SECRET` (if using payments)
- [ ] `GOOGLE_CALENDAR_API_KEY` (if using calendar)
- [ ] `GOOGLE_CALENDAR_ID` (if using calendar)
- [ ] `CRM_WEBHOOK_SECRET` (if using CRM webhooks)

### 2.3 All Edge Functions Deployed

Go to **Edge Functions** and verify all 15 are listed and active:

- [ ] `ai-engine`
- [ ] `job-scheduler`
- [ ] `closer-engine`
- [ ] `meeting-scheduler`
- [ ] `invoice-pdf`
- [ ] `payment-engine`
- [ ] `payment-link`
- [ ] `document-engine`
- [ ] `whatsapp-webhook`
- [ ] `meta-webhook`
- [ ] `linkedin-webhook`
- [ ] `crm-webhook`
- [ ] `ops-intelligence`
- [ ] `reporting-engine`
- [ ] `mis-engine`

### 2.4 Storage Bucket Created

- [ ] `documents` bucket exists (Storage section)
- [ ] Bucket is set to **Private**
- [ ] Storage RLS policies are in place (4 policies: read, insert, update, delete)

### 2.5 RLS Policies Verified

- [ ] All tables have `rowsecurity = true`
- [ ] Anon users cannot write to any table (except SELECT on brands)
- [ ] Authenticated users are properly scoped by role
- [ ] Service role bypasses RLS (test by calling an edge function)

### 2.6 Auth Configuration

- [ ] Email auth is enabled (Supabase Dashboard → Authentication → Providers → Email)
- [ ] Site URL is set to your Vercel URL (Authentication → URL Configuration → Site URL)
- [ ] Redirect URLs include your Vercel URL (Authentication → URL Configuration → Redirect URLs)

---

## 3. Webhook Registration

Each external service needs to be pointed at your Supabase edge function URLs.

### Webhook URL Format

All edge function URLs follow this pattern:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/FUNCTION_NAME
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference (the part before `.supabase.co` in your project URL).

---

### 3.1 WhatsApp Webhook

**Prerequisites:** Meta Developer account, WhatsApp Business API setup.

1. Go to [developers.facebook.com](https://developers.facebook.com).
2. Select your app → **WhatsApp → Configuration → Webhook**.
3. Set:
   - **Callback URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** The same value you set in `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Click **"Verify and Save"**.
5. Subscribe to the `messages` event.

**Test:** Send a test message to your WhatsApp Business number. Check:
- Edge function logs in Supabase Dashboard → `whatsapp-webhook` → Logs
- `leads` table for a new row (if the message contains lead-like data)

---

### 3.2 Meta Lead Ads Webhook

**Prerequisites:** Meta Business account, a published Lead Ads form.

1. Go to [developers.facebook.com](https://developers.facebook.com).
2. Select your app → **Webhooks → (your page)**.
3. Set:
   - **Callback URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/meta-webhook`
   - **Verify Token:** The same value you set in `META_WEBHOOK_VERIFY_TOKEN`
4. Click **"Verify and Save"**.
5. Subscribe to the `leadgen` event.

**Test:** Submit a test lead through your Lead Ads form. Verify:
- Edge function logs show the incoming payload
- A new lead appears in the database
- An AI qualification job is queued in `ai_jobs`

---

### 3.3 LinkedIn Webhook

**Prerequisites:** LinkedIn Developer app, LinkedIn Lead Gen Forms.

1. Go to [developer.linkedin.com](https://developer.linkedin.com).
2. Select your app → **Products → Lead Gen Forms → Webhooks**.
3. Set:
   - **Webhook URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/linkedin-webhook`
   - **Authorization:** `Bearer YOUR_LINKEDIN_WEBHOOK_VERIFY_TOKEN`

> **Note:** LinkedIn uses `Authorization: Bearer <token>` header verification, not the Meta-style hub challenge.

**Test:** Submit a test lead via LinkedIn Lead Gen Forms. Verify in edge function logs and the `leads` table.

---

### 3.4 Razorpay Webhook

**Prerequisites:** Razorpay account with webhooks enabled.

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Navigate to **Settings → Webhooks**.
3. Click **"Add Webhook"**.
4. Set:
   - **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-engine`
   - **Secret:** The same value you set in `RAZORPAY_WEBHOOK_SECRET`
5. Select events to listen for:
   - `payment.captured`
   - `payment.failed`
   - `payment.refunded`
6. Save.

**Test:** Create a test payment via Razorpay test mode. Verify:
- `payment_webhooks` table logs the event
- `payments` table is updated with the payment status
- `invoices` table status changes from "Pending" to "Paid"

---

## 4. Google Calendar Setup

### 4.1 Create a Google Cloud Project and API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or select existing).
3. Go to **APIs & Services → Library**.
4. Search for **"Google Calendar API"** and enable it.
5. Go to **APIs & Services → Credentials**.
6. Click **"Create Credentials" → API Key**.
7. Copy the API key → set as `GOOGLE_CALENDAR_API_KEY` in Supabase secrets.
8. (Recommended) Restrict the API key to only the Calendar API.

### 4.2 Create and Share a Calendar

1. Go to [calendar.google.com](https://calendar.google.com).
2. Create a new calendar (e.g., "Franchisee Kart Consultations").
3. Go to **Settings and sharing** for that calendar.
4. Copy the **Calendar ID** (appears under "Integrate calendar") → set as `GOOGLE_CALENDAR_ID` in Supabase secrets.
5. Under **Access permissions**, set:
   - **Make available to public:** ON (or share with specific service accounts)
   - Check **"See only free/busy (hide details)"** if you don't want to expose event details

### 4.3 Test Calendar Integration

1. Create a few events on the calendar to simulate busy slots.
2. Call the meeting-scheduler edge function to find available slots.
3. Verify it returns correct available time windows.

---

## 5. Post-Deployment Verification Checklist

Run through this checklist after completing all setup steps.

### Authentication & Access

- [ ] Users can sign up / log in via email
- [ ] New users are auto-linked to a `consultants` row (check `consultants` table)
- [ ] Different roles see appropriate data (test with Founder and RM accounts)
- [ ] Anon (logged-out) users cannot access data

### Core Features

- [ ] Dashboard loads with KPI metrics
- [ ] Leads page shows the lead pipeline
- [ ] Creating a lead triggers an auto-qualification AI job
- [ ] AI Jobs page shows job queue and status
- [ ] Meeting scheduling works (with or without Google Calendar)
- [ ] Invoices can be viewed and payment links generated

### Webhook Integrations

- [ ] WhatsApp webhook is verified (returns 200 on challenge)
- [ ] Meta webhook is verified (returns 200 on challenge)
- [ ] LinkedIn webhook accepts authenticated requests
- [ ] Razorpay webhook processes test payments correctly

### AI Pipeline

- [ ] A new lead gets auto-qualified (check `ai_jobs` for `QUALIFY_LEAD` job)
- [ ] AI engine processes jobs (check job status changes to `completed`)
- [ ] AI outcomes are recorded in `ai_outcomes` table
- [ ] Agent activity log shows entries in `agent_activity_log`

### Monitoring

- [ ] Edge function logs are visible in Supabase Dashboard
- [ ] Database metrics look healthy (no long-running queries)
- [ ] Realtime subscriptions work (lead updates appear without refresh)

---

## Rollback Procedure

If something goes wrong during deployment:

### Frontend Rollback

1. Go to Vercel → **Deployments**.
2. Find the last working deployment.
3. Click **"..." → "Redeploy"** to roll back.

### Database Rollback

Migrations are **not** easily reversible because they use `IF NOT EXISTS`. To roll back:

1. **Don't panic** — most issues are RLS policy problems, not data loss.
2. Check Supabase Dashboard → **Database → Logs** for errors.
3. For RLS issues, re-run the Phase 0 security migration.
4. For data issues, use the SQL Editor to `UPDATE` or `DELETE` affected rows.
5. **Full reset (nuclear option):** Create a new Supabase project and re-run all migrations from scratch. You will lose all data.

### Edge Function Rollback

1. Go to Supabase Dashboard → **Edge Functions**.
2. Click the function → view its code.
3. Replace with the previous working version.
4. Click **"Deploy"**.