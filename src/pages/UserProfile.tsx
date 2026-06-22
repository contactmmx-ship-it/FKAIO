import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Consultant } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Shield,
  Building2,
  CheckCircle,
  Save,
  Key,
  Send,
} from 'lucide-react';

const roleColors: Record<string, string> = {
  Founder: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  OpsHead: 'bg-red-500/20 text-red-400 border-red-500/30',
  BrandManager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RM: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Accounts: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Trainer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export default function UserProfile() {
  const { user, consultant } = useAuth() as { user: { id: string; email: string } | null; consultant: Consultant | null };
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [brands, setBrands] = useState<{ id: string; name: string; slug: string; sector: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (consultant) {
        setName(consultant.name);
        setPhone(consultant.phone || '');
        setDepartment(consultant.department || '');

        // Load assigned brands
        const { data: cbData } = await supabase
          .from('consultant_brands')
          .select('brand_id')
          .eq('consultant_id', consultant.id);

        const brandIds = (cbData || []).map((cb) => cb.brand_id);
        if (brandIds.length > 0) {
          const { data: brandsData } = await supabase
            .from('brands')
            .select('id, name, slug, sector')
            .in('id', brandIds);
          setBrands(brandsData || []);
        }
      }
      setResetEmail(user?.email || '');
      setLoading(false);
    }
    loadProfile();
  }, [consultant, user]);

  async function handleSave() {
    if (!consultant) return;
    setSaving(true);
    setMessage('');
    await supabase
      .from('consultants')
      .update({
        name,
        phone: phone || null,
        department,
      })
      .eq('id', consultant.id);
    setMessage('Profile updated successfully');
    setTimeout(() => setMessage(''), 3000);
    setSaving(false);
  }

  async function handlePasswordReset() {
    setResetLoading(true);
    setResetSent(false);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setResetSent(true);
      setMessage('');
    }
    setResetLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold">My Profile</h2>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Avatar Banner */}
        <div className="h-24 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border-b border-slate-800" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-2xl font-bold border-4 border-slate-900 shadow-lg flex-shrink-0">
              {consultant?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="pb-1">
              <p className="text-xl font-bold">{consultant?.name || 'User'}</p>
              <div className="flex items-center gap-2 mt-1">
                {consultant?.role && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${roleColors[consultant.role] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {consultant.role}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="w-3 h-3" /> {user?.email}
                </span>
              </div>
            </div>
          </div>

          {message && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 mb-4">
              <CheckCircle className="w-4 h-4" /> {message}
            </div>
          )}

          {/* Edit Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600/50 transition-colors"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600/50 transition-colors"
              >
                <option value="SALES">Sales</option>
                <option value="MARKETING">Marketing</option>
                <option value="OPERATIONS">Operations</option>
                <option value="FINANCE">Finance</option>
                <option value="HR">HR</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Brands */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-semibold">Assigned Brands</h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{brands.length}</span>
        </div>
        {brands.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-cyan-400 flex-shrink-0">
                  {brand.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{brand.name}</p>
                  <p className="text-xs text-slate-500">{brand.sector || brand.slug}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No brands assigned yet.</p>
        )}
      </div>

      {/* Password Reset */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-semibold">Change Password</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Enter your email to receive a password reset link.
        </p>
        {resetSent ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400">
            <CheckCircle className="w-4 h-4" /> Password reset link sent to {resetEmail}. Check your inbox.
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600/50 transition-colors"
              placeholder="your@email.com"
            />
            <button
              onClick={handlePasswordReset}
              disabled={resetLoading || !resetEmail}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-sm font-semibold rounded-xl transition-all border border-amber-600/30 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-semibold">Account Info</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
            <span className="text-sm text-slate-400">User ID</span>
            <span className="text-xs text-slate-500 font-mono">{user?.id?.slice(0, 12)}...</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
            <span className="text-sm text-slate-400">Email</span>
            <span className="text-sm text-slate-300">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
            <span className="text-sm text-slate-400">Role</span>
            <span className="text-sm text-slate-300">{consultant?.role || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
            <span className="text-sm text-slate-400">Joined</span>
            <span className="text-sm text-slate-300">
              {consultant?.created_at ? new Date(consultant.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
