import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
      <div className="text-center max-w-md">
        {/* Illustration */}
        <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center shadow-2xl shadow-slate-900/50">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
        </div>

        {/* 404 Code */}
        <h1 className="text-7xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
          404
        </h1>

        {/* Message */}
        <p className="text-xl font-semibold text-white mb-2">Page Not Found</p>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back to the dashboard.
        </p>

        {/* Action Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Decorative */}
        <div className="mt-12 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-700" />
          <div className="w-2 h-2 rounded-full bg-slate-600" />
          <div className="w-2 h-2 rounded-full bg-slate-700" />
        </div>
      </div>
    </div>
  );
}
