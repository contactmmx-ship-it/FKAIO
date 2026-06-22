import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
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
              <p className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 font-mono break-all">
                {this.state.error.message}
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