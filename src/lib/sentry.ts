/**
 * Sentry Frontend Integration — Lazy Initializer
 *
 * Only initializes Sentry if VITE_SENTRY_DSN is set.
 * Safe to import — will not crash without the SDK installed or DSN configured.
 * Must be dynamically imported from main.tsx so the module resolves even
 * when @sentry/react is not present in node_modules.
 */

import type { User } from '../lib/supabase';

let _sentryInitialized = false;
let _identifyUser: ((user: { id: string; email?: string; name?: string }) => void) | null = null;

export interface SentryInitResult {
  initialized: boolean;
  identifyUser: (user: { id: string; email?: string; name?: string }) => void;
}

/**
 * Initialize Sentry with React SDK.
 * Call this once from main.tsx before rendering.
 * Returns { initialized: false } if DSN is missing — app keeps working.
 */
export async function initSentry(): Promise<SentryInitResult> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

  if (!dsn) {
    console.info('[Sentry] VITE_SENTRY_DSN not set — skipping Sentry initialization.');
    return {
      initialized: false,
      identifyUser: () => {},
    };
  }

  if (_sentryInitialized) {
    return {
      initialized: true,
      identifyUser: _identifyUser || (() => {}),
    };
  }

  try {
    // Dynamic import — avoids crashing if @sentry/react is not installed
    const Sentry = await import('@sentry/react');

    Sentry.init({
      dsn,
      // 10% performance / transaction sampling
      sampleRate: 0.1,
      tracesSampleRate: 0.1,
      // Don't send in localhost
      enabled: import.meta.env.DEV === false || dsn.includes('sentry.io'),
      // Supabase project context tag
      initialScope: {
        tags: {
          supabase_project: supabaseUrl.replace(/https:\/\//, '').split('.')[0] || 'unknown',
          app: 'fkaios-frontend',
        },
      },
      // Release tracking (injected by Vite if SENTRY_RELEASE is set)
      ...(import.meta.env.SENTRY_RELEASE ? { release: import.meta.env.SENTRY_RELEASE as string } : {}),
      // Filter out noisy errors
      beforeSend(event) {
        // Drop console.log-level breadcrumbs in prod
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter(
            (b) => b.level !== 'info' && b.level !== 'debug'
          );
        }
        // Drop network errors that are just cancelled requests
        if (event.exception?.values?.[0]?.type === 'TypeError') {
          const msg = event.exception.values[0].value || '';
          if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('Load failed')) {
            return null;
          }
        }
        return event;
      },
      // Integrations — browser tracing + replay (if available)
      integrations: [
        Sentry.browserTracingIntegration({
          tracePropagationTargets: [
            supabaseUrl,
            // Also trace edge functions on the same project
            /.*\.supabase\.co\/functions\/.*/,
          ],
        }),
      ],
      // Environment
      environment: import.meta.env.MODE || 'development',
    });

    _sentryInitialized = true;

    _identifyUser = (user: { id: string; email?: string; name?: string }) => {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
      });
    };

    console.info('[Sentry] Initialized successfully.');
    return { initialized: true, identifyUser: _identifyUser };
  } catch (err) {
    // @sentry/react not installed or failed to load — graceful degradation
    console.warn('[Sentry] Failed to initialize Sentry. App continues without error tracking.', err);
    return {
      initialized: false,
      identifyUser: () => {},
    };
  }
}

/**
 * Identify the current user in Sentry for richer error context.
 * Safe to call even if Sentry is not initialized.
 */
export function identifySentryUser(user: User | null): void {
  if (!_identifyUser || !user) return;
  _identifyUser({
    id: user.id,
    email: user.email,
    name: (user as unknown as Record<string, unknown>).user_metadata !== undefined
      ? ((user as unknown as Record<string, unknown>).user_metadata as Record<string, string>)?.name || user.email
      : user.email,
  });
}

/**
 * Capture an exception manually. No-op if Sentry is not initialized.
 */
export async function captureException(error: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!_sentryInitialized) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.captureException(error, {
      extra: context,
    });
  } catch {
    // Silently fail
  }
}

/**
 * Set a custom tag on the current Sentry scope.
 */
export async function setSentryTag(key: string, value: string): Promise<void> {
  if (!_sentryInitialized) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.setTag(key, value);
  } catch {
    // Silently fail
  }
}