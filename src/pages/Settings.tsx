import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Settings, Brain, Shield, Save, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*');
    const settingsMap: any = {};
    data?.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    setSettings(settingsMap);
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    setMessage('');
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    }
    setMessage('Settings saved successfully');
    setTimeout(() => setMessage(''), 3000);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {message && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400">
          <CheckCircle className="w-4 h-4" /> {message}
        </div>
      )}

      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
        {['general', 'ai', 'security'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Company Name</label>
              <input value={settings?.company_name || 'Franchisee Kart'} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Currency</label>
              <select value={settings?.currency || 'INR'} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Default Lead Source</label>
              <select value={settings?.default_source || 'Website'} onChange={(e) => setSettings({ ...settings, default_source: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                <option>Website</option>
                <option>WhatsApp</option>
                <option>Facebook</option>
                <option>Google Ads</option>
                <option>Referral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Timezone</label>
              <select value={settings?.timezone || 'Asia/Kolkata'} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold">AI Engine Settings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Auto-Qualify Leads</label>
              <select value={settings?.auto_qualify || 'enabled'} onChange={(e) => setSettings({ ...settings, auto_qualify: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Auto-Follow-up</label>
              <select value={settings?.auto_followup || 'enabled'} onChange={(e) => setSettings({ ...settings, auto_followup: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Hot Lead Threshold</label>
              <input type="number" value={settings?.hot_threshold || 70} onChange={(e) => setSettings({ ...settings, hot_threshold: parseInt(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Self-Learning Mode</label>
              <select value={settings?.self_learning || 'enabled'} onChange={(e) => setSettings({ ...settings, self_learning: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold">Security</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
              <div>
                <p className="text-sm font-medium">Email Authentication</p>
                <p className="text-xs text-slate-500">Supabase email/password auth</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" /> Active
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
              <div>
                <p className="text-sm font-medium">Row Level Security</p>
                <p className="text-xs text-slate-500">RLS policies on all tables</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" /> Active
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
              <div>
                <p className="text-sm font-medium">Data Encryption</p>
                <p className="text-xs text-slate-500">Supabase AES-256 encryption at rest</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" /> Active
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
