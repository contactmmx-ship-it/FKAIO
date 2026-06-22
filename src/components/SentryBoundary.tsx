import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * SentryBoundary — A React Error Boundary that sends caught errors to Sentry.
 *
 * If Sentry is not initialized, it falls back to console.error — identical
 * behavior to the existing ErrorBoundary, just with Sentry reporting added.
 *
 * Styling matches the existing ErrorBoundary component for visual consistency.
 */
interface SentryBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI. If not provided, uses the default styled fallback. */
  fallback?: React.ReactNode;
  /** Optional callback when an error is caught (before Sentry). */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface SentryBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class SentryBoundary extends React.Component<SentryBoundaryProps, SentryBoundaryState> {
  constructor(props: SentryBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): SentryBoundaryState {
    return { hasError: true, error, eventId: null };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Call optional callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Always log to console
    console.error('[SentryBoundary] Caught error:', error, errorInfo);

    // Try to send to Sentry
    try {
      const Sentry = await import('@sentry/react');
      const eventId = Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
      this.setState({ eventId });
    } catch {
      // @sentry/react not available — that's fine, error already logged to console
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, eventId: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback — matches existing ErrorBoundary style
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
          <div className="text-center max-w-md">
            {/* Illustration */}
            <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-red-900/50 to-slate-900 border border-red-500/30 flex items-center justify-center shadow-2xl shadow-red-500/10">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>

            {/* Error Code */}
            <h1 className="text-7xl font-black bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent mb-4">
              !
            </h1>

            {/* Message */}
            <p className="text-xl font-semibold text-white mb-2">Something went wrong</p>
            <p className="text-sm text-slate-400 mb-2 leading-relaxed">
              An unexpected error occurred. This has been logged for review.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}

            {/* Sentry event ID for reference */}
            {this.state.eventId && (
              <p className="text-xs text-slate-600 mb-4 font-mono">
                Error ID: {this.state.eventId}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
              >
                <Home className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SentryBoundary;