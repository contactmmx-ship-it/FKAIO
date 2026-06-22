# Franchisee Kart AI OS (FKAiOS)

## Overview

Autonomous AI-powered franchise sales operating system with **25+ AI agents**, real-time lead capture, automated follow-ups, meeting scheduling, invoice generation, and payment processing. FKAiOS replaces a multi-person sales operations team with a self-evolving AI workforce that handles the entire franchise sales lifecycle — from first inquiry to onboarding fee collection.

**Key Capabilities:**

- Real-time lead capture from WhatsApp, Meta Lead Ads, LinkedIn, and generic CRM webhooks
- AI-powered lead qualification, scoring, and automated follow-up sequences
- Automated meeting scheduling with Google Calendar integration
- GST-compliant invoice generation with Razorpay payment processing
- Role-based access control (Founder, OpsHead, RM, Accounts, BrandManager, Trainer)
- Self-evolving AI agents that learn from outcomes and improve over time
- Real-time dashboards, MIS reports, and operational intelligence

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| **Backend / BaaS** | Supabase (PostgreSQL + Auth + Edge Functions + Storage + Realtime) |
| **AI (Primary)** | Anthropic Claude 3 Haiku via Edge Functions |
| **AI (Fallback)** | OpenAI GPT-4o-mini via Edge Functions |
| **Payments** | Razorpay (order creation, payment links, webhook verification) |
| **Messaging** | Meta WhatsApp Business API |
| **Lead Sources** | Meta Lead Ads, LinkedIn Lead Gen Forms, Generic CRM Webhooks |
| **Calendar** | Google Calendar API (free/busy slot lookup) |
| **Routing** | React Router v7 (client-side) |
| **Icons** | Lucide React |

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ (or `bun` as an alternative)
- **Supabase account** (free tier works for development)
- **Anthropic API key** — required for all AI features (Claude 3 Haiku)
- **OpenAI API key** — optional, used as fallback if Anthropic is unavailable
- **Razorpay account** — required for payment processing features
- **Meta Developer account** — required for WhatsApp Business and Lead Ads webhooks
- **LinkedIn Developer account** — required for LinkedIn lead webhooks
- **Google Cloud account** — required for Calendar API integration

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> fkaios-production
cd fkaios-production

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key

# 4. Set up Supabase database
#    See docs/SUPABASE_SETUP.md for detailed instructions
#    - Run all 9 migrations in order (SQL Editor)
#    - Create the 'documents' storage bucket
#    - Set edge function secrets

# 5. Deploy edge functions
supabase functions deploy

# 6. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Project Structure

```
fkaios-production/
├── .env                              # Environment variables (NEVER commit real values)
├── .env.example                      # Template for environment variables
├── index.html                        # Vite HTML entry point
├── package.json                      # Dependencies and scripts
├── vite.config.ts                    # Vite configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.json / tsconfig.app.json # TypeScript configuration
├── postcss.config.js                 # PostCSS configuration
├── eslint.config.js                  # ESLint configuration
│
├── docs/                             # DevOps documentation
│   ├── ENVIRONMENT_VARIABLES.md      # Complete env var reference
│   ├── SUPABASE_SETUP.md             # Step-by-step Supabase setup
│   ├── DEPLOYMENT.md                 # Production deployment guide
│   └── BACKUP_MONITORING.md          # Backup and monitoring strategy
│
├── src/                              # Frontend React application
│   ├── main.tsx                      # App entry point
│   ├── App.tsx                       # Root component with providers
│   ├── AppRouter.tsx                 # Route definitions
│   ├── index.css                     # Global styles (Tailwind)
│   ├── vite-env.d.ts                 # Vite type declarations
│   │
│   ├── context/
│   │   └── AuthContext.tsx            # Supabase auth state management
│   │
│   ├── hooks/
│   │   ├── usePagination.ts          # Pagination hook for list views
│   │   └── useSupabaseRealtime.ts    # Realtime subscription hook
│   │
│   ├── lib/
│   │   └── supabase.ts               # Supabase client initialization
│   │
│   ├── utils/
│   │   └── validation.ts             # Form validation utilities
│   │
│   ├── components/
│   │   ├── Layout.tsx                # Main app shell (sidebar + header + content)
│   │   ├── ErrorBoundary.tsx         # React error boundary
│   │   ├── EmptyState.tsx            # Empty data placeholder
│   │   └── LoadingSkeleton.tsx       # Loading state skeletons
│   │
│   └── pages/
│       ├── Login.tsx                 # Authentication page
│       ├── Dashboard.tsx             # Main dashboard with KPIs
│       ├── Leads.tsx                 # Lead pipeline management
│       ├── LeadDetail.tsx            # Individual lead view with activities
│       ├── Meetings.tsx              # Meeting calendar and management
│       ├── Calendar.tsx              # Google Calendar integration view
│       ├── Invoices.tsx              # Invoice list and management
│       ├── Notifications.tsx         # In-app notification center
│       ├── AIAgents.tsx              # AI agent directory and status
│       ├── AIJobs.tsx                # AI job queue and history
│       ├── AgentMemory.tsx           # Agent memory and learning data
│       ├── AI Evolution.tsx           # Agent self-improvement tracking
│       ├── WorkflowManager.tsx       # Automation workflow editor
│       ├── CommandCentre.tsx         # Strategic command center
│       ├── BrandManagement.tsx       # Brand CRUD and settings
│       ├── TeamManagement.tsx        # Consultant team management
│       ├── Settings.tsx              # Application settings
│       ├── UserProfile.tsx           # User profile page
│       └── NotFound.tsx              # 404 page
│
└── supabase/
    ├── migrations/                   # PostgreSQL migrations (run in order)
    │   ├── 20260618111535_franchisee_kart_aios_schema.sql
    │   ├── 20260618113146_create_ai_jobs_table.sql
    │   ├── 20260618143017_add_agent_memory_and_workflows.sql
    │   ├── 20260619120000_phase0_security_rbac.sql
    │   ├── 20260620150000_phase2_invoices_payments.sql
    │   ├── 20260620160000_phase3_negotiation_tracking.sql
    │   ├── 20260621000000_phase3_fix_missing_rls.sql
    │   ├── 20260621010000_phase4_automation_triggers.sql
    │   └── 20260621020000_phase6_document_storage.sql
    │
    └── functions/                    # Supabase Edge Functions (Deno)
        ├── ai-engine/                # Core AI job execution engine
        ├── job-scheduler/            # Cron-like job scheduler (processes pending AI jobs)
        ├── closer-engine/            # AI-powered deal closing and objection handling
        ├── meeting-scheduler/        # Meeting slot lookup and scheduling
        ├── invoice-pdf/              # GST invoice HTML rendering
        ├── payment-engine/           # Razorpay order creation and webhook processing
        ├── payment-link/             # Razorpay payment link generation
        ├── document-engine/          # Document upload URL generation and verification
        ├── whatsapp-webhook/         # WhatsApp Business webhook handler
        ├── meta-webhook/             # Meta Lead Ads webhook handler
        ├── linkedin-webhook/         # LinkedIn Lead Gen webhook handler
        ├── crm-webhook/              # Generic CRM webhook handler (API key auth)
        ├── ops-intelligence/         # Operational intelligence and pipeline analysis
        ├── reporting-engine/         # AI-powered strategic metrics and recommendations
        ├── mis-engine/               # MIS report generation (daily/weekly/monthly)
        └── ...
```

---

## Environment Variables

See [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) for the complete reference.

**Required for basic operation:**

| Variable | Location | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | `.env` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Your Supabase anonymous key |
| `ANTHROPIC_API_KEY` | Edge Function Secret | Anthropic Claude API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function Secret | Service role key for admin operations |

**Required for specific features:**

| Feature | Required Secrets |
|---------|-----------------|
| WhatsApp integration | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| Meta Lead Ads | `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN` |
| LinkedIn Leads | `LINKEDIN_WEBHOOK_VERIFY_TOKEN` |
| Payment processing | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Google Calendar | `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_CALENDAR_ID` |
| CRM webhooks | `CRM_WEBHOOK_SECRET` |
| AI fallback | `OPENAI_API_KEY` |

---

## Database Migrations

Migrations must be run **in the exact order listed below** via the Supabase SQL Editor. See [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) for detailed instructions.

| # | Migration File | Description |
|---|---------------|-------------|
| 1 | `20260618111535_franchisee_kart_aios_schema.sql` | **Core schema** — 13 tables (brands, consultants, leads, lead_activities, meetings, documents, invoices, payments, ai_agents, ai_jobs, ai_outcomes, ai_evolution, notifications, settings), RLS policies, indexes, seed data for 5 brands and 25 AI agents |
| 2 | `20260618113146_create_ai_jobs_table.sql` | **AI jobs table** — standalone `ai_jobs` table (idempotent with `IF NOT EXISTS`; the core schema already creates this table, so this migration is a no-op) |
| 3 | `20260618143017_add_agent_memory_and_workflows.sql` | **Agent intelligence** — adds `agent_memory`, `agent_workflows`, `agent_objectives`, `agent_activity_log`, `agent_conversations` tables; extends `ai_agents` with personality/performance columns; seeds objectives for all 25 agents |
| 4 | `20260619120000_phase0_security_rbac.sql` | **Security & RBAC** — adds `consultant_brands` mapping; creates security helper functions (`get_my_role()`, `is_admin()`, `my_brand_ids()`); auto-links auth users to consultant rows; replaces all open RLS policies with role+brand scoped policies |
| 5 | `20260620150000_phase2_invoices_payments.sql` | **Payment enhancement** — adds `invoice_items` and `payment_webhooks` tables; extends invoices/payments with Razorpay fields |
| 6 | `20260620160000_phase3_negotiation_tracking.sql` | **Negotiation tracking** — adds negotiation state machine to leads; creates `lead_objections` and `negotiation_history` tables |
| 7 | `20260621000000_phase3_fix_missing_rls.sql` | **RLS fix** — adds missing RLS policies for Phase 2/3 tables (`invoice_items`, `payment_webhooks`, `lead_objections`, `negotiation_history`) |
| 8 | `20260621010000_phase4_automation_triggers.sql` | **Automation triggers** — 5 database triggers: auto-qualify new leads, auto-follow-up on stage change, auto-schedule meeting, auto-generate proposal, auto-generate invoice |
| 9 | `20260621020000_phase6_document_storage.sql` | **Document storage** — creates the `documents` storage bucket (10MB limit, specific MIME types); adds storage RLS policies; extends documents table with `file_url`, `file_size`, `version` columns |

---

## Edge Functions

All edge functions run in the Supabase Deno runtime. They use the **service role key** to bypass RLS for automated operations.

| Function | Description | Required Secrets |
|----------|-------------|-----------------|
| `ai-engine` | Core AI execution engine. Processes pending `ai_jobs`, calls Claude/GPT with agent-specific prompts, stores results. Endpoints: `POST /` (submit job), `POST /run_jobs` (batch process). | `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (optional) |
| `job-scheduler` | Cron-like scheduler. Fetches pending jobs and invokes the AI engine. Supports scheduled, manual, and event-driven processing. Can be called via pings/cron. | `SUPABASE_SERVICE_ROLE_KEY` |
| `closer-engine` | AI-powered deal closing. Handles objection resolution, deal readiness scoring, and pricing strategy suggestions via Claude. | `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `meeting-scheduler` | Meeting management. Finds available slots via Google Calendar API, creates meetings in the database, sends WhatsApp confirmations. | `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_CALENDAR_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| `invoice-pdf` | Invoice rendering. Generates professional HTML invoices with GST breakdowns, line items, and company branding. Returns printable HTML. | `SUPABASE_SERVICE_ROLE_KEY` |
| `payment-engine` | Payment processing. Creates Razorpay orders, generates invoices, processes payment webhooks with HMAC signature verification. | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| `payment-link` | Payment link generation. Creates Razorpay payment links for invoices and sends them to leads via WhatsApp. | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| `document-engine` | Document management. Generates signed upload URLs for Supabase Storage, verifies uploaded documents, and creates document records. | `SUPABASE_SERVICE_ROLE_KEY` |
| `whatsapp-webhook` | WhatsApp webhook handler. Verifies Meta webhook challenge (GET), processes incoming messages (POST), extracts lead data, creates leads in the database. | `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| `meta-webhook` | Meta Lead Ads webhook handler. Verifies webhook challenge (GET), processes lead form submissions (POST), creates/updates leads and queues AI qualification. | `SUPABASE_SERVICE_ROLE_KEY`, `META_WEBHOOK_VERIFY_TOKEN`, `META_ACCESS_TOKEN` |
| `linkedin-webhook` | LinkedIn Lead Gen webhook handler. Verifies via Bearer token (Authorization header), processes LinkedIn lead form submissions, creates leads. | `SUPABASE_SERVICE_ROLE_KEY`, `LINKEDIN_WEBHOOK_VERIFY_TOKEN` |
| `crm-webhook` | Generic CRM webhook handler. Accepts leads via API key authentication (X-API-Key header, Bearer token, or query param). Flexible lead creation/upsert. | `SUPABASE_SERVICE_ROLE_KEY`, `CRM_WEBHOOK_SECRET` |
| `ops-intelligence` | Operational intelligence. Analyzes pipeline velocity, identifies bottlenecks, computes stage conversion rates, and provides actionable recommendations. | `SUPABASE_SERVICE_ROLE_KEY` |
| `reporting-engine` | Strategic reporting. Gathers system-wide metrics, analyzes agent performance, generates founder briefings with risk assessment and growth recommendations. | `SUPABASE_SERVICE_ROLE_KEY` |
| `mis-engine` | MIS report generation. Produces daily briefings, weekly summaries, and monthly P&L reports with lead pipeline data, conversion metrics, and revenue tracking. | `SUPABASE_SERVICE_ROLE_KEY` |

---

## Architecture

### Multi-Agent AI System

FKAiOS uses a **job queue pattern** for AI orchestration:

1. **Triggers** create jobs — Database triggers (Phase 4) automatically queue `ai_jobs` rows when leads are created or stages change. Webhooks (WhatsApp, Meta, LinkedIn, CRM) also queue jobs.

2. **Job scheduler** processes the queue — The `job-scheduler` edge function polls for pending jobs and dispatches them to the `ai-engine`.

3. **AI engine executes with agent context** — For each job, the `ai-engine` loads the corresponding `ai_agents` row to get the agent's system prompt, then calls Claude (primary) or GPT-4o-mini (fallback) with structured JSON instructions.

4. **Results are stored and tracked** — Job results, outcomes, and agent performance metrics are recorded in `ai_outcomes` and `ai_evolution` tables.

5. **Agents self-improve** — The system tracks success rates and can evolve agent prompts over time based on outcome data.

### Role-Based Access Control

```
Founder / OpsHead  → Full access to everything
BrandManager       → Full access scoped to assigned brand(s)
RM (Consultant)    → Leads/activities/meetings/docs assigned to them
Accounts           → Full access to invoices/payments; read-only on leads
Trainer            → Read-only dashboard and notifications
```

Security is enforced at the database level via PostgreSQL RLS policies — not in application code.

### Webhook Pipeline

```
External Source → Supabase Edge Function → Database Insert → DB Trigger → AI Job → AI Engine → LLM → Result
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite development server (port 5173) |
| `npm run build` | Production build to `dist/` directory |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint checks |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Environment Variables Guide](docs/ENVIRONMENT_VARIABLES.md) | Complete reference for all environment variables and secrets |
| [Supabase Setup Guide](docs/SUPABASE_SETUP.md) | Step-by-step database and backend setup |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment (Vercel + Supabase) |
| [Backup & Monitoring](docs/BACKUP_MONITORING.md) | Backup strategies, monitoring, and recovery procedures |

---

## License

Proprietary — Franchisee Kart. All rights reserved.