import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Lazy-initialize Sentry before React mounts.
 * Uses dynamic import so the app never crashes if @sentry/react
 * is not installed or VITE_SENTRY_DSN is not configured.
 */
async function bootstrap() {
  try {
    const { initSentry } = await import('./lib/sentry.ts');
    await initSentry();
  } catch {
    // Sentry module not available — continue without it
    console.info('[bootstrap] Sentry not available, continuing without error tracking.');
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();