import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, Zap, Activity, Brain,
  ArrowUpRight, Radio, Sparkles, Wifi, WifiOff
} from 'lucide-react';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';

// BUG 2 FIX: Static color mapping instead of dynamic Tailwind classes
const kpiColorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  violet: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime: leads INSERT → add to recentLeads
  const handleLeadInsert = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      const newLead = payload.new;
      setAllLeads((prev) => [newLead, ...prev]);
      setRecentLeads((prev) => [newLead, ...prev].slice(0, 5));
      // Update stats
      setStats((prev: any) => {
        if (!prev) return prev;
        const updated = { ...prev, total_leads: prev.total_leads + 1 };
        if (newLead.lead_score > 70) updated.hot_leads = prev.hot_leads + 1;
        return updated;
      });
    }
  }, []);

  // Realtime: ai_jobs UPDATE → update job counts
  const handleJobUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' && payload.new) {
      const newJob = payload.new;
      const oldJob = payload.old;
      setStats((prev: any) => {
        if (!prev) return prev;
        const updated = { ...prev };
        // Decrement old status
        if (oldJob.status === 'pending' || oldJob.status === 'running') {
          updated.pending_jobs = Math.max(0, updated.pending_jobs - 1);
        }
        if (oldJob.status === 'completed') {
          updated.completed_jobs = Math.max(0, updated.completed_jobs - 1);
        }
        if (oldJob.status === 'failed') {
          updated.failed_jobs = Math.max(0, updated.failed_jobs - 1);
        }
        // Increment new status
        if (newJob.status === 'pending' || newJob.status === 'running') {
          updated.pending_jobs = updated.pending_jobs + 1;
        }
        if (newJob.status === 'completed') {
          updated.completed_jobs = updated.completed_jobs + 1;
        }
        if (newJob.status === 'failed') {
          updated.failed_jobs = updated.failed_jobs + 1;
        }
        return updated;
      });
    }
  }, []);

  const { isConnected: leadsConnected } = useSupabaseRealtime({
    table: 'leads',
    event: 'INSERT',
    callback: handleLeadInsert,
  });

  const { isConnected: jobsConnected } = useSupabaseRealtime({
    table: 'ai_jobs',
    event: 'UPDATE',
    callback: handleJobUpdate,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    const { data: agents } = await supabase.from('ai_agents').select('*').eq('is_active', true).order('dept');
    const { data: jobs } = await supabase.from('ai_jobs').select('status').in('status', ['pending', 'running', 'completed', 'failed']);

    const total = leads?.length || 0;
    const hot = leads?.filter((l: any) => l.lead_score > 70).length || 0;
    const onboarded = leads?.filter((l: any) => l.stage === 'Onboarded').length || 0;
    const lost = leads?.filter((l: any) => l.stage === 'Lost').length || 0;
    const conversion = total > 0 ? ((onboarded / total) * 100).toFixed(1) : '0';
    const pendingJobs = jobs?.filter((j: any) => j.status === 'pending' || j.status === 'running').length || 0;
    const completedJobs = jobs?.filter((j: any) => j.status === 'completed').length || 0;
    const failedJobs = jobs?.filter((j: any) => j.status === 'failed').length || 0;

    const allLeadsList = leads || [];
    setAllLeads(allLeadsList);
    setRecentLeads(allLeadsList.slice(0, 5));
    setActiveAgents(agents?.slice(0, 6) || []);

    setStats({
      total_leads: total,
      hot_leads: hot,
      onboarded,
      lost,
      conversion,
      pending_jobs: pendingJobs,
      completed_jobs: completedJobs,
      failed_jobs: failedJobs,
      active_agents_count: agents?.length || 0,
    });
    setLoading(false);
  }

  const kpiCards = [
    { label: 'Total Leads', value: stats?.total_leads ?? 0, icon: Users, color: 'blue' },
    { label: 'Hot Leads', value: stats?.hot_leads ?? 0, icon: TrendingUp, color: 'amber' },
    { label: 'Onboarded', value: stats?.onboarded ?? 0, icon: Zap, color: 'emerald' },
    { label: 'Conversion Rate', value: `${stats?.conversion ?? 0}%`, icon: Activity, color: 'violet' },
  ];

  const stageColors: Record<string, string> = {
    Inquiry: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Contacted: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    Qualified: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'Meeting Scheduled': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    'Proposal Sent': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    Negotiation: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'Registration Fee': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Agreement: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    'Onboarding Fee': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    Onboarded: 'bg-green-500/20 text-green-400 border-green-500/30',
    Lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const realtimeConnected = leadsConnected || jobsConnected;

  return (
    <div className="space-y-6">
      {/* Command Centre Banner */}
      <Link to="/command-centre" className="block">
        <div className="bg-gradient-to-r from-cyan-900/50 via-blue-900/50 to-slate-900 border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/50 transition-all relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-50" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                <Radio className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  JARVIS Command Centre
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                </h2>
                <p className="text-cyan-300/80 text-sm">Your autonomous AI organization is online and operating in real-time</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Realtime connection indicator */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${realtimeConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                {realtimeConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {realtimeConnected ? 'Live' : 'Polling'}
              </div>
              <div className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl">
                <span className="text-cyan-400 font-mono text-sm">{stats?.active_agents_count ?? 0} Agents Active</span>
              </div>
              <ArrowUpRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </div>
        </div>
      </Link>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const colorClasses = kpiColorMap[kpi.color] || kpiColorMap.blue;
          return (
            <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${colorClasses.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 ${colorClasses.text}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{kpi.value}</p>
              <p className="text-sm text-slate-500 mt-1">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* AI Workforce Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold">AI Workforce Status</h3>
            </div>
            <Link to="/ai-jobs" className="text-sm text-blue-400 hover:text-blue-300 font-medium">View All Jobs</Link>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{stats?.pending_jobs}</p>
              <p className="text-xs text-slate-500 mt-1">Pending Jobs</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats?.completed_jobs}</p>
              <p className="text-xs text-slate-500 mt-1">Completed</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{stats?.failed_jobs}</p>
              <p className="text-xs text-slate-500 mt-1">Failed</p>
            </div>
          </div>
          <div className="space-y-3">
            {activeAgents.slice(0, 4).map((agent: any) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-slate-500">{agent.dept} — {agent.task}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-400 font-medium">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold">Recent Leads</h3>
            </div>
            <Link to="/leads" className="text-sm text-blue-400 hover:text-blue-300 font-medium">View All</Link>
          </div>
          <div className="space-y-3">
            {recentLeads.map((lead: any) => (
              <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-all group">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                  {lead.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">{lead.name}</p>
                  <p className="text-xs text-slate-500">{lead.city} · {lead.investment_capacity}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${stageColors[lead.stage] || 'bg-slate-500/20 text-slate-400'}`}>
                  {lead.stage}
                </span>
              </Link>
            ))}
            {recentLeads.length === 0 && (
              <EmptyState
                icon={Users}
                title="No leads yet"
                description="Add your first lead to get started."
                actionLabel="Add Lead"
                onAction={() => window.location.href = '/leads'}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Snapshot */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold">Pipeline Snapshot</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['Inquiry', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Registration Fee', 'Agreement', 'Onboarding Fee', 'Onboarded'].map((stage) => {
            const count = allLeads.filter((l: any) => l.stage === stage).length;
            return (
              <div key={stage} className="min-w-[140px] bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-white">{count}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight uppercase tracking-wider">{stage}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}