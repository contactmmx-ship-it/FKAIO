import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Cpu, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw,
  Play, Search, Brain, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { usePagination } from '../hooks/usePagination';
import EmptyState from '../components/EmptyState';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  retry: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  running: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
  retry: AlertTriangle,
};

// BUG 4 FIX: Static color mapping for stats section instead of dynamic Tailwind classes
const statColorMap: Record<string, string> = {
  amber: 'text-amber-400',
  blue: 'text-blue-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
};

export default function AIJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Realtime: ai_jobs UPDATE for status changes
  const handleJobUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' && payload.new) {
      setJobs((prev) =>
        prev.map((j) => (j.id === payload.new.id ? { ...j, ...payload.new } : j))
      );
      // Auto-refresh selected job detail if it's the one that changed
      setSelectedJob((prev: any) => {
        if (prev && prev.id === payload.new.id) {
          return { ...prev, ...payload.new };
        }
        return prev;
      });
    }
  }, []);

  const { isConnected: rtConnected } = useSupabaseRealtime({
    table: 'ai_jobs',
    event: 'UPDATE',
    callback: handleJobUpdate,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function loadData() {
    setLoading(true);
    const { data: jobsData } = await supabase
      .from('ai_jobs')
      .select('*, agent:agent_id(*)')
      .order('created_at', { ascending: false });
    const { data: agentsData } = await supabase.from('ai_agents').select('*').eq('is_active', true);
    setJobs(jobsData || []);
    setAgents(agentsData || []);
    setLoading(false);
  }

  async function retryJob(job: any) {
    await supabase.from('ai_jobs').update({ status: 'pending', retry_count: (job.retry_count || 0) + 1 }).eq('id', job.id);
    await supabase.functions.invoke('ai-engine', { body: { action: 'run_jobs' } });
    loadData();
  }

  async function runBatchJobs() {
    let remaining = jobs.filter((j) => j.status === 'pending').length;
    if (remaining === 0) {
      alert('No pending jobs to run');
      return;
    }
    while (remaining > 0) {
      const { error } = await supabase.functions.invoke('ai-engine', { body: { action: 'run_jobs' } });
      if (error) {
        alert(`Batch run hit an error: ${error.message}`);
        break;
      }
      const { count: pendingCount } = await supabase
        .from('ai_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      remaining = pendingCount ?? 0;
    }
    loadData();
  }

  async function createJob(agent: any) {
    await supabase.functions.invoke('ai-engine', {
      body: {
        action: 'queue_job',
        type: agent.task,
        agent_id: agent.id,
        payload: { agent_name: agent.name, created_from_dashboard: true },
      },
    });
    loadData();
  }

  const filtered = jobs.filter((j) => {
    const matchFilter = !filter || (j.type.toLowerCase().includes(filter.toLowerCase()) || (j.agent?.name || '').toLowerCase().includes(filter.toLowerCase()));
    const matchStatus = !statusFilter || j.status === statusFilter;
    return matchFilter && matchStatus;
  });

  const stats = {
    pending: jobs.filter((j) => j.status === 'pending').length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  // Pagination
  const { currentPage, totalPages, nextPage, prevPage, goToPage, paginatedData, startIndex, endIndex } = usePagination({
    totalItems: filtered.length,
    pageSize: 20,
  });

  const paginatedJobs = paginatedData(filtered);

  // Reset page when filters change
  useEffect(() => {
    goToPage(1);
  }, [filter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'amber', icon: Clock },
          { label: 'Running', value: stats.running, color: 'blue', icon: RefreshCw },
          { label: 'Completed', value: stats.completed, color: 'emerald', icon: CheckCircle },
          { label: 'Failed', value: stats.failed, color: 'red', icon: XCircle },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${statColorMap[stat.color] || 'text-slate-400'}`} />
              <span className="text-xs text-slate-500 font-semibold uppercase">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${statColorMap[stat.color] || 'text-white'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${autoRefresh ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}>
            <RefreshCw className="w-3 h-3" /> Auto Refresh
          </button>
          <button onClick={runBatchJobs} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-sm font-medium rounded-xl transition-all border border-emerald-600/30">
            <Play className="w-3 h-3" /> Run Batch
          </button>
          {rtConnected && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              Live
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search jobs..." className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-48" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="retry">Retry</option>
          </select>
        </div>
      </div>

      {/* Quick Create */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-slate-300">Quick Agent Jobs</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {agents.slice(0, 6).map((agent) => (
            <button key={agent.id} onClick={() => createJob(agent)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/30 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded-xl transition-all">
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-semibold">Job</th>
                <th className="text-left px-6 py-3 font-semibold">Agent</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th className="text-left px-6 py-3 font-semibold">Retries</th>
                <th className="text-left px-6 py-3 font-semibold">Created</th>
                <th className="text-left px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedJobs.map((job) => {
                const Icon = statusIcons[job.status] || Clock;
                return (
                  <tr key={job.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500" />
                        <span className="font-medium text-white">{job.type}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{job.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-6 py-3 text-slate-400">{job.agent?.name || 'Unassigned'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[job.status] || ''}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-400">{job.retry_count}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">{new Date(job.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3">
                      {job.status === 'failed' && (
                        <button onClick={(e) => { e.stopPropagation(); retryJob(job); }} className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Cpu}
            title="No jobs found"
            description="Create jobs by adding leads or clicking agent jobs."
          />
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing {startIndex + 1}-{endIndex} of {filtered.length} jobs
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">Job Details</h3>
              <button onClick={() => setSelectedJob(null)} className="text-slate-500 hover:text-white transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 text-xs uppercase">Type</span><p className="font-medium text-white mt-1">{selectedJob.type}</p></div>
                <div><span className="text-slate-500 text-xs uppercase">Status</span><span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[selectedJob.status] || ''}`}>{selectedJob.status}</span></div>
              </div>
              <div><span className="text-slate-500 text-xs uppercase">Agent</span><p className="font-medium text-white mt-1">{selectedJob.agent?.name || 'Unassigned'}</p></div>
              <div><span className="text-slate-500 text-xs uppercase">Payload</span>
                <pre className="mt-1 bg-slate-800 rounded-xl p-3 text-xs text-slate-400 overflow-auto">{JSON.stringify(selectedJob.payload, null, 2)}</pre>
              </div>
              {selectedJob.result && (
                <div><span className="text-slate-500 text-xs uppercase">Result</span>
                  <pre className="mt-1 bg-slate-800 rounded-xl p-3 text-xs text-emerald-400 overflow-auto">{JSON.stringify(selectedJob.result, null, 2)}</pre>
                </div>
              )}
              {selectedJob.error && (
                <div><span className="text-slate-500 text-xs uppercase">Error</span>
                  <pre className="mt-1 bg-slate-800 rounded-xl p-3 text-xs text-red-400 overflow-auto">{selectedJob.error}</pre>
                </div>
              )}
              <div className="text-xs text-slate-500">Created: {new Date(selectedJob.created_at).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}