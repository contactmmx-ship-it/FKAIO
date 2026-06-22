import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Brain, Eye, EyeOff, Zap, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { validateEmail } from '../utils/validation';

type AuthMode = 'login' | 'signup' | 'reset';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    // Email validation
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Enter a valid email address';
    }

    // Password validation (only for login/signup, not reset)
    if (mode !== 'reset') {
      if (!password) {
        errors.password = 'Password is required';
      } else if (password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        await signUp(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validate email for reset
    const errors: Record<string, string> = {};
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Enter a valid email address';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setResetSent(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950" />
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg shadow-blue-500/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Franchisee Kart</h1>
          <p className="text-slate-400 mt-1.5 text-sm font-medium uppercase tracking-widest">AIOS — AI Operating System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">

          {/* Reset Success State */}
          {mode === 'reset' && resetSent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-2">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Check your email</h2>
              <p className="text-sm text-slate-400">
                We've sent a password reset link to <span className="text-slate-300 font-medium">{email}</span>
              </p>
              <button
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium mt-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {/* Tab Switcher (login/signup only) */}
              {mode !== 'reset' && (
                <div className="flex mb-6 bg-slate-800/50 rounded-xl p-1">
                  {(['login', 'signup'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        mode === m
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>
              )}

              {/* Form Title for reset */}
              {mode === 'reset' && (
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={() => switchMode('login')} className="text-slate-500 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white">Reset Password</h2>
                </div>
              )}

              <form onSubmit={mode === 'reset' ? handleResetPassword : handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: '' })); }}
                    placeholder="you@franchiseekart.com"
                    className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all ${fieldErrors.email ? 'border-red-500' : 'border-slate-700'}`}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-red-400 mt-1.5">{fieldErrors.email}</p>
                  )}
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: '' })); }}
                        placeholder="••••••••"
                        className={`w-full bg-slate-800 border rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all ${fieldErrors.password ? 'border-red-500' : 'border-slate-700'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-xs text-red-400 mt-1.5">{fieldErrors.password}</p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === 'reset' ? (
                        <>
                          <Mail className="w-4 h-4" />
                          Send Reset Link
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </>
                      )}
                    </>
                  )}
                </button>
              </form>

              {/* Forgot Password link (login mode only) */}
              {mode === 'login' && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 pt-6 border-t border-slate-800">
            {[
              { label: '25 AI Agents', sub: 'Active Workforce' },
              { label: '5 Brands', sub: 'Multi-brand' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-white font-bold">{item.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}