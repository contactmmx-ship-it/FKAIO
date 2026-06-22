# Phase 8–9 Work Record

## Phase 8: Google Calendar OAuth Flow

### Files Modified
- **`supabase/functions/meeting-scheduler/index.ts`** — Complete rewrite

### Changes Summary

1. **OAuth Token Management**
   - Added `refreshGoogleToken()` — calls `POST https://oauth2.googleapis.com/token` with client_id, client_secret, refresh_token, grant_type=refresh_token
   - Added `getGoogleAccessToken()` — looks up OAuth credentials in `agent_memory` (memory_type='oauth', content->>'provider'='google_calendar'), keyed by consultant_id stored in the content JSONB. Checks token expiry with 5-min buffer, refreshes if needed, and updates the stored token in agent_memory after refresh.
   - Added `getGoogleAuthHeaders()` — unified auth header builder. For write operations, requires OAuth; falls back to API key for read-only operations with clear error message: *"Calendar write operations require Google OAuth setup."*

2. **Full Meeting CRUD**
   - `handleCreateMeeting()` — Creates Google Calendar event with attendees array, email+popup reminders, Google Meet conference link (via `conferenceData.createRequest`). Stores google_calendar_event_id in the meetings DB table. Returns meet_link.
   - `handleUpdateMeeting()` — Patches existing Google Calendar event. Supports updating title, description, start/end time, and attendees.
   - `handleCancelMeeting()` — DELETEs the Google Calendar event, updates DB status to 'Cancelled', logs lead activity.
   - `handleListMeetings()` — Fetches meetings from DB with joins to leads/consultants, plus parallel fetch from Google Calendar API if OAuth available. Supports filtering by consultant_id, lead_id, status, date range, pagination.
   - Existing `handleScheduleMeeting()` and `handleConfirmSlot()` preserved and enhanced to use OAuth.

3. **Environment Variables**
   - `GOOGLE_CLIENT_ID` — Google OAuth 2.0 Client ID
   - `GOOGLE_CLIENT_SECRET` — Google OAuth 2.0 Client Secret
   - Documented in `.env.example` with setup instructions

4. **Graceful Degradation**
   - All write operations check for OAuth availability first
   - Clear error messages when OAuth is not configured
   - Read operations (freebusy, list) fall back to API key
   - OAuth token refresh failures are logged but don't crash the request

### Database Requirements
- `agent_memory.memory_type` CHECK constraint must include 'oauth' (added in Phase 9 migration)
- `meetings.google_calendar_event_id` column (added in Phase 9 migration)

---

## Phase 9: Observability — Sentry + Structured Metrics

### Files Created
- **`src/lib/sentry.ts`** — Sentry frontend initialization module
- **`src/components/SentryBoundary.tsx`** — Sentry ErrorBoundary component
- **`supabase/functions/_shared/metrics.ts`** — Edge function metrics SDK
- **`supabase/migrations/20260622010000_phase9_observability.sql`** — Database migration

### Files Modified
- **`src/main.tsx`** — Async bootstrap that lazy-imports and initializes Sentry
- **`src/vite-env.d.ts`** — Added `VITE_SENTRY_DSN` type
- **`.env.example`** — Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_SENTRY_DSN`

### Sentry Frontend (`src/lib/sentry.ts`)
- `initSentry()` — Reads `VITE_SENTRY_DSN` from import.meta.env, dynamically imports @sentry/react
- Configured with `sampleRate: 0.1` and `tracesSampleRate: 0.1` (10% sampling)
- Sets Supabase project context tag (extracted from VITE_SUPABASE_URL)
- Browser tracing integration targeting Supabase URL
- `beforeSend` filter drops noisy network errors and info/debug breadcrumbs
- `identifySentryUser()` for user identification from AuthContext
- `captureException()` and `setSentryTag()` convenience wrappers
- Returns `{ initialized: false }` if DSN missing — never crashes

### SentryBoundary (`src/components/SentryBoundary.tsx`)
- React class component ErrorBoundary that calls `Sentry.captureException()` in `componentDidCatch`
- Passes `componentStack` via React context for rich error reports
- Displays Sentry event ID for support reference
- Fallback UI matches existing ErrorBoundary exactly (same layout, colors, buttons)
- Falls back to console.error if @sentry/react not available

### Edge Function Metrics (`supabase/functions/_shared/metrics.ts`)
- `recordMetric(supabase, name, value, tags?, unit?, recordedAt?)` — writes to metrics table
- `recordMetricBatch(supabase, metrics[])` — batch insert
- `getMetrics(supabase, period, name?, tags?, limit?, offset?)` — reads metrics with time-range, name, tag filtering, pagination
- `getMetricSummary(supabase, name, period, tags?)` — returns count/sum/avg/min/max
- `measureLatency(supabase, fn, extraTags?)` — wraps async fn, records api_latency_ms + error_count
- Auto-infers unit from metric name (_ms → ms, _usd → usd, etc.)
- Period parsing: '1h', '6h', '24h', '7d', '30d', '90d' or explicit {start, end}

### Database Migration
- **`metrics` table**: id, name, value, unit, tags (jsonb), recorded_at — with RLS
- **`metric_aggregates` table**: metric_name, period_date, period_type (hourly/daily/weekly/monthly), count, sum, avg, min_val, max_val, p50, p95, p99, tags (jsonb) — with UNIQUE constraint
- **Indexes**: 7 indexes on metrics (time-range, name, compound, GIN tags), 5 on metric_aggregates
- **`compute_metric_aggregates()`** function: Computes daily aggregates per metric (ungrouped + per-function), deletes raw data >90 days
- **`agent_memory`**: ALTER CHECK constraint to add 'oauth' to allowed memory_type values
- **`meetings`**: Adds `google_calendar_event_id` column if missing

### main.tsx Bootstrap
- Converted to async `bootstrap()` function
- Dynamic imports `./lib/sentry.ts` and calls `initSentry()`
- Wrapped in try/catch — continues without Sentry if module unavailable
- React render happens after Sentry init (or failure)