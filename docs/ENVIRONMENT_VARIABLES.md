# Environment Variables Reference

This document lists **all** environment variables used by FKAiOS, organized by where they are configured.

---

## Frontend Variables (`.env` file in project root)

These variables are bundled into the frontend at build time by Vite. The `VITE_` prefix is required for Vite to expose them to the browser.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_SUPABASE_URL` | **Yes** | Your Supabase project URL. Found in Supabase Dashboard → Settings → API → Project URL. | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Your Supabase anonymous (public) key. Found in Supabase Dashboard → Settings → API → Project API keys → anon public. | `eyJhbGciOiJIUzI1NiIs...` |

### Important Notes

- **Never commit real values** to version control. Use `.env.example` as the template.
- The anon key is safe to expose in the frontend — it is designed to be public and is restricted by RLS policies.
- The service role key must **never** be exposed in the frontend. It is only used in edge functions.

---

## Edge Function Secrets (Set in Supabase Dashboard)

These are **not** in the `.env` file. They are set in the Supabase Dashboard and are only accessible to Edge Functions running in the Supabase Deno runtime.

**How to set secrets:** Supabase Dashboard → Edge Functions → Secrets tab → Add key-value pairs.

Or via CLI:
```bash
supabase secrets set SECRET_NAME=value
```

---

### AI / LLM Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | `ai-engine`, `closer-engine`, `meeting-scheduler` | Anthropic API key for Claude 3 Haiku. This is the primary LLM used for all AI features. Get one at [console.anthropic.com](https://console.anthropic.com). |
| `OPENAI_API_KEY` | No | `ai-engine` | OpenAI API key for GPT-4o-mini. Used as a fallback when Anthropic calls fail. Get one at [platform.openai.com](https://platform.openai.com). |

### Supabase Internal Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | All edge functions | Bypasses RLS policies for automated backend operations. Found in Supabase Dashboard → Settings → API → Project API keys → service_role secret. **Never expose this in frontend code.** |

> **Note:** `SUPABASE_URL` is automatically available to all edge functions via `Deno.env.get("SUPABASE_URL")`. You do not need to set it as a secret.

---

### WhatsApp Business Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `WHATSAPP_ACCESS_TOKEN` | For WhatsApp features | `whatsapp-webhook`, `meeting-scheduler`, `payment-link` | Long-lived access token from Meta App. Used to send WhatsApp messages and verify leads. Generated in Meta App Dashboard → WhatsApp → API Setup → Temporary Token → then made permanent. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | For WhatsApp features | `whatsapp-webhook` | Custom verification token you define. When configuring the webhook in Meta Dashboard, enter the same token. Used for `hub.verify_token` challenge-response. |
| `WHATSAPP_PHONE_NUMBER_ID` | For WhatsApp features | `meeting-scheduler`, `payment-link` | The phone number ID for your WhatsApp Business account. Found in Meta App Dashboard → WhatsApp → API Setup → Phone Number ID. |

---

### Meta (Facebook) Lead Ads Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `META_ACCESS_TOKEN` | For Meta Lead Ads | `meta-webhook` | Page access token with `leads` permission. Used to fetch lead form data from Meta's API after receiving a webhook notification. |
| `META_WEBHOOK_VERIFY_TOKEN` | For Meta Lead Ads | `meta-webhook` | Custom verification token you define. Used for `hub.verify_token` challenge-response when registering the webhook in Meta Developer Dashboard. |

---

### LinkedIn Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `LINKEDIN_WEBHOOK_VERIFY_TOKEN` | For LinkedIn leads | `linkedin-webhook` | Custom verification token. LinkedIn webhooks are verified via `Authorization: Bearer <token>` header (not hub challenge like Meta). |

---

### Razorpay (Payments) Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | For payment features | `payment-engine`, `payment-link` | Your Razorpay public key ID. Found in Razorpay Dashboard → Settings → API Keys → Key ID. |
| `RAZORPAY_KEY_SECRET` | For payment features | `payment-engine`, `payment-link` | Your Razorpay secret key. Found in Razorpay Dashboard → Settings → API Keys → Secret. **Keep this secret.** |
| `RAZORPAY_WEBHOOK_SECRET` | For payment features | `payment-engine` | Webhook secret for verifying Razorpay payment event signatures (HMAC-SHA256). Configured in Razorpay Dashboard → Settings → Webhooks → Webhook Secret. |

---

### Google Calendar Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CALENDAR_API_KEY` | For meeting scheduling | `meeting-scheduler` | Google Cloud API key with Calendar API enabled. Used for free/busy slot lookups. Create in Google Cloud Console → APIs & Services → Credentials. |
| `GOOGLE_CALENDAR_ID` | For meeting scheduling | `meeting-scheduler` | The email address of the shared Google Calendar used for booking meetings (e.g., `consultations@franchiseekart.com`). The calendar must have "Make available to public" or be shared with the service account. |

---

### CRM Webhook Secrets

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `CRM_WEBHOOK_SECRET` | For CRM integration | `crm-webhook` | Generic API key for authenticating incoming CRM webhook requests. Verified via `X-API-Key` header, `Authorization: Bearer` header, or `?api_key=` query parameter. If not set, all requests are allowed (dev mode). |

---

## Quick Reference: Which Secrets Does Each Function Need?

| Edge Function | Required Secrets |
|---------------|-----------------|
| `ai-engine` | `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (fallback) |
| `job-scheduler` | `SUPABASE_SERVICE_ROLE_KEY` |
| `closer-engine` | `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` |
| `meeting-scheduler` | `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_CALENDAR_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| `invoice-pdf` | `SUPABASE_SERVICE_ROLE_KEY` |
| `payment-engine` | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| `payment-link` | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| `document-engine` | `SUPABASE_SERVICE_ROLE_KEY` |
| `whatsapp-webhook` | `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| `meta-webhook` | `SUPABASE_SERVICE_ROLE_KEY`, `META_WEBHOOK_VERIFY_TOKEN`, `META_ACCESS_TOKEN` |
| `linkedin-webhook` | `SUPABASE_SERVICE_ROLE_KEY`, `LINKEDIN_WEBHOOK_VERIFY_TOKEN` |
| `crm-webhook` | `SUPABASE_SERVICE_ROLE_KEY`, `CRM_WEBHOOK_SECRET` |
| `ops-intelligence` | `SUPABASE_SERVICE_ROLE_KEY` |
| `reporting-engine` | `SUPABASE_SERVICE_ROLE_KEY` |
| `mis-engine` | `SUPABASE_SERVICE_ROLE_KEY` |

---

## Security Best Practices

1. **Never commit `.env` files** — Add `.env` to your `.gitignore` (it should already be there).
2. **Use different keys per environment** — Use separate Supabase projects for development and production.
3. **Rotate secrets regularly** — Set a calendar reminder to rotate API keys and webhook secrets every 90 days.
4. **Restrict API key permissions** — For Google Calendar API key, restrict it to only the Calendar API. For Meta tokens, request minimum required permissions.
5. **Monitor key usage** — Check Anthropic/OpenAI dashboards for unusual API usage patterns.
6. **Store secrets securely** — Use Supabase's built-in secret management. Do not hardcode secrets in function code.