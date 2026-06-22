# Backup & Monitoring Strategy

This document covers database backups, log monitoring, error tracking, and recovery procedures for FKAiOS.

---

## 1. Database Backup

### 1.1 Automatic Backups (Supabase Managed)

Supabase includes **daily automated backups** on all paid plans (Pro and above). These are point-in-time PostgreSQL backups stored by Supabase.

| Plan | Backup Retention | Point-in-Time Recovery |
|------|-----------------|----------------------|
| Free | None | Not available |
| Pro ($25/mo) | 7 days | Available (within retention window) |
| Enterprise | 30+ days (configurable) | Available |

**To restore from an automatic backup:**

1. Go to Supabase Dashboard → **Database → Backups**.
2. Find the backup snapshot you want to restore.
3. Click **"Restore"**.
4. Confirm the restoration. This will replace the current database.

> **Warning:** Restoring a backup replaces the entire database. All data added after the backup point will be lost.

### 1.2 Manual Backup (Recommended for All Plans)

For additional safety, especially on the Free plan, create manual backups regularly.

#### Via SQL Editor (Export Schema + Data)

1. Go to Supabase Dashboard → **Database → Backups**.
2. Click **"Create Backup"** (available on Pro plans).
3. Download the backup file.

#### Via `pg_dump` (Full Control)

Install `pg_dump` (comes with PostgreSQL client tools) and run:

```bash
# Full backup (schema + data)
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --no-owner --no-acl \
  -f backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only (no data)
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --schema-only --no-owner --no-acl \
  -f schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Data only (no schema)
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --data-only --no-owner --no-acl \
  -f data_backup_$(date +%Y%m%d_%H%M%S).sql
```

You can find your database connection string in Supabase Dashboard → **Settings → Database → Connection string** (URI tab).

#### Backup Storage Strategy

- Store backup files in a secure, off-platform location (e.g., Google Cloud Storage, AWS S3, or encrypted local storage).
- **Encrypt** backups containing PII (personally identifiable information).
- Keep at least **7 days** of rolling backups.
- Keep at least **1 monthly** backup for 12 months.

#### Automated Backups with Cron (Self-Hosted)

If you have a server that can run cron jobs:

```bash
# Add to crontab (crontab -e)
# Run daily at 2:00 AM
0 2 * * * pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" --no-owner --no-acl -f /backups/fkaios_$(date +\%Y\%m\%d).sql && find /backups -name "fkaios_*.sql" -mtime +7 -delete
```

---

## 2. Edge Function Logs

### 2.1 Viewing Logs in Supabase Dashboard

1. Go to **Edge Functions** in the left sidebar.
2. Click on a specific function (e.g., `ai-engine`).
3. Click the **"Logs"** tab.
4. Logs show:
   - Timestamp
   - Request method and path
   - Response status code
   - `console.log` output from the function
   - Error messages and stack traces

### 2.2 Log Retention

Supabase retains edge function logs for **7 days** on the Pro plan. For longer retention, forward logs to an external service.

### 2.3 Structured Logging Best Practices

Edge functions already use `console.log` / `console.error`. For production, consider adding structured logging:

```typescript
// Example: structured log entry
console.log(JSON.stringify({
  level: 'info',
  event: 'lead_created',
  lead_id: leadId,
  source: 'whatsapp',
  timestamp: new Date().toISOString()
}));
```

This makes logs searchable and parseable by external log management tools.

---

## 3. Error Tracking (Optional: Sentry)

For production-grade error tracking, integrate [Sentry](https://sentry.io).

### 3.1 Frontend Setup

```bash
npm install @sentry/react
```

In `src/main.tsx`:

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
```

### 3.2 Edge Function Setup

In each edge function, wrap the handler with Sentry capture:

```typescript
// At the top of the edge function
try {
  // ... existing function logic
} catch (error) {
  console.error(JSON.stringify({
    level: 'error',
    function: 'ai-engine',
    error: error.message,
    stack: error.stack
  }));
  // Optionally send to Sentry via HTTP
}
```

> **Note:** Sentry's Deno SDK support is limited. For edge functions, the simplest approach is to use `console.error` with structured JSON and forward logs via a log drain.

### 3.3 Alternatives to Sentry

| Tool | Free Tier | Notes |
|------|-----------|-------|
| [Sentry](https://sentry.io) | 5K errors/month | Best for React apps |
| [LogRocket](https://logrocket.com) | 1K sessions/month | Session replay + errors |
| [Datadog](https://datadog.com) | 14-day trial | Full observability platform |
| [BetterStack](https://betterstack.com) | Limited | Log management + uptime |

---

## 4. Performance Monitoring

### 4.1 Supabase Built-in Metrics

Supabase provides built-in monitoring accessible from the Dashboard:

| Metric | Location | What to Watch |
|--------|----------|---------------|
| **Database Size** | Database → Reports | Growth trend; alert if growing > 100MB/month unexpectedly |
| **Active Connections** | Database → Reports | Should stay under connection pool limit |
| **Query Performance** | Database → Reports | Look for slow queries (> 1 second) |
| **Cache Hit Ratio** | Database → Reports | Should be > 90% for frequently accessed data |
| **Edge Function Invocations** | Edge Functions → Overview | Track daily call volume |
| **Edge Function Errors** | Edge Functions → Overview | Error rate should be < 1% |
| **Storage Usage** | Storage → Overview | Monitor uploaded document storage |
| **Bandwidth** | Edge Functions → Overview | Monitor egress for cost control |

### 4.2 Key Database Queries to Monitor

Run these periodically in the SQL Editor:

```sql
-- Tables with most rows (growth monitoring)
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Slow queries (queries taking > 500ms)
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
WHERE mean_exec_time > 500
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Dead tuples (tables needing VACUUM)
SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- AI job success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM ai_jobs
GROUP BY status
ORDER BY count DESC;
```

### 4.3 Vercel Monitoring (Frontend)

Vercel provides built-in monitoring:

- **Speed Insights:** Core Web Vitals (LCP, FID, CLS) — enable in Vercel Dashboard → your project → **Analytics → Speed Insights**.
- **Web Analytics:** Page views, visitor geography, device breakdown — enable in Vercel Dashboard → your project → **Analytics → Web Analytics**.

---

## 5. Uptime Monitoring

Set up external uptime monitoring to get alerted when the application goes down.

### Recommended Tools

| Tool | Free Tier | Check Interval |
|------|-----------|---------------|
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5-min intervals | 5 minutes |
| [BetterStack](https://betterstack.com/uptime) | 10 monitors, 1-min intervals | 1 minute |
| [Pingdom](https://pingdom.com) | No free tier | 1 minute |

### What to Monitor

| Monitor | URL / Method | Expected Response |
|---------|-------------|-------------------|
| Frontend is serving | `GET https://your-domain.com` | HTTP 200, contains HTML |
| AI Engine is responding | `POST https://PROJECT_REF.supabase.co/functions/v1/ai-engine` with empty body | HTTP 200 or 400 (not 500) |
| Payment Engine is up | `POST https://PROJECT_REF.supabase.co/functions/v1/payment-engine` with empty body | HTTP 200 or 400 (not 500) |
| MIS Engine is up | `GET https://PROJECT_REF.supabase.co/functions/v1/mis-engine?action=daily_briefing` | HTTP 200 with JSON |
| Database is reachable | `GET https://PROJECT_REF.supabase.co/rest/v1/brands?select=id&limit=1` with anon key | HTTP 200 with JSON array |

### Alerting Configuration

- **Primary:** Email alerts to the DevOps/Founder email.
- **Secondary:** Slack/Discord webhook for team notifications.
- **Escalation:** If no acknowledgment within 15 minutes, escalate via SMS.

---

## 6. Recovery Procedures

### 6.1 Database Connection Exhausted

**Symptoms:** Frontend shows errors like "FATAL: too many connections for role."

**Recovery:**
1. Go to Supabase Dashboard → **Database → Connection Pooling**.
2. Check current connection count.
3. Enable **Connection Pooling** (Supavisor) if not already enabled.
4. Update `src/lib/supabase.ts` to use the pooler connection string (port 6543).
5. If using the direct connection, check for connection leaks in edge functions (ensure `createClient` uses `persistSession: false`).

### 6.2 Edge Function Returning 500 Errors

**Symptoms:** AI jobs stay in `running` status, webhook integrations fail.

**Recovery:**
1. Open Supabase Dashboard → **Edge Functions** → click the failing function → **Logs**.
2. Identify the error from the log output.
3. Common causes:
   - **Missing secret:** Check that the required secret is set in Edge Functions → Secrets.
   - **API rate limit:** Anthropic/OpenAI rate limit reached — wait and retry.
   - **API key invalid:** Check the key hasn't been rotated or revoked.
   - **Timeout:** Edge functions have a 150-second timeout. Large AI jobs may need optimization.
4. Fix the root cause.
5. Redeploy the function if code changes are needed.
6. Retry failed jobs by updating their status:

```sql
-- Reset stuck jobs to pending for retry
UPDATE ai_jobs
SET status = 'pending', retry_count = retry_count + 1
WHERE status IN ('running', 'failed')
  AND retry_count < 3;
```

### 6.3 Webhook Not Receiving Data

**Symptoms:** Leads not appearing from WhatsApp/Meta/LinkedIn.

**Recovery:**
1. **Verify webhook URL is correct** in the external service's dashboard.
2. **Test verification:** Manually call the webhook URL with a GET request and the verify token.
3. **Check logs:** Look at the edge function logs for the specific webhook.
4. **Check token:** Ensure the verify token matches between the external service and the Supabase secret.
5. **Re-register:** Remove and re-register the webhook in the external service.

### 6.4 RLS Blocking Legitimate Access

**Symptoms:** Authenticated users see empty tables or "no data" messages.

**Recovery:**
1. Check that the user has a `consultants` row with `auth_user_id` set:

```sql
SELECT c.id, c.name, c.role, c.auth_user_id
FROM consultants c
JOIN auth.users u ON u.id = c.auth_user_id
WHERE u.email = 'user@example.com';
```

2. If no row exists, check if the auth trigger is working:

```sql
SELECT proname, tgname FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgname = 'on_auth_user_created';
```

3. If the trigger exists but the user still has no consultant row, manually create one:

```sql
INSERT INTO consultants (auth_user_id, name, email, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@example.com'),
  'User Name',
  'user@example.com',
  'RM'
);
```

4. If the issue is role-based (user can't see data they should), check their brand assignments:

```sql
SELECT cb.brand_id, b.name
FROM consultant_brands cb
JOIN brands b ON b.id = cb.brand_id
JOIN consultants c ON c.id = cb.consultant_id
WHERE c.email = 'user@example.com';
```

### 6.5 Payment Processing Failure

**Symptoms:** Razorpay payments not being recorded, invoices stuck in "Pending".

**Recovery:**
1. Check `payment_webhooks` table for incoming events and their `processed` status.
2. Check `RAZORPAY_WEBHOOK_SECRET` matches between Supabase and Razorpay Dashboard.
3. Verify Razorpay webhook is active in Razorpay Dashboard → Settings → Webhooks.
4. If webhooks were missed, manually update payments:

```sql
-- Mark an invoice as paid (after verifying payment in Razorpay Dashboard)
UPDATE invoices SET status = 'Paid' WHERE id = 'INVOICE_UUID';

INSERT INTO payments (lead_id, invoice_id, amount, method, status, razorpay_payment_id)
VALUES ('LEAD_UUID', 'INVOICE_UUID', AMOUNT, 'razorpay', 'Confirmed', 'pay_XXXXX');
```

### 6.6 Complete System Recovery (Nuclear Option)

If the database is corrupted or data is irrecoverably lost:

1. **Create a new Supabase project** (or use "Pause and restore" if available).
2. **Re-run all 9 migrations** in order (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)).
3. **Re-set all edge function secrets**.
4. **Re-deploy all 15 edge functions**.
5. **Re-verify seed data** (5 brands, 25 agents, 25 objectives).
6. **Re-register all webhooks** in external services (WhatsApp, Meta, LinkedIn, Razorpay).
7. **Re-create user accounts** in Supabase Auth.
8. **Update Vercel environment variables** if the Supabase URL changed.

**Estimated recovery time:** 30–60 minutes (assuming you have this documentation and a `.env.example`).

---

## 7. Routine Maintenance Schedule

| Frequency | Task | Owner |
|-----------|------|-------|
| **Daily** | Check edge function error logs | DevOps |
| **Daily** | Review failed AI jobs and retry if needed | DevOps |
| **Weekly** | Review database size and connection metrics | DevOps |
| **Weekly** | Check webhook delivery success rates | DevOps |
| **Monthly** | Take a manual database backup | DevOps |
| **Monthly** | Review and rotate API keys (Anthropic, OpenAI, Razorpay) | Security |
| **Monthly** | Review AI agent performance metrics | Product |
| **Quarterly** | Review and update RLS policies if roles change | Security |
| **Quarterly** | Test full restore from backup | DevOps |