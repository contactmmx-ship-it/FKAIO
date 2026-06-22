import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  Brain,
  Sparkles,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  ToggleLeft,
  ToggleRight,
  Search,
  Target,
  XCircle,
} from 'lucide-react';

type EvolutionEntry = {
  id: string;
  agent_name: string;
  old_prompt: string | null;
  new_prompt: string | null;
  reason: string | null;
  performance_gain: number;
  created_at: string;
};

const agentColors = [
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-violet-500 to-purple-500',
  'from-pink-500 to-rose-500',
  'from-cyan-500 to-sky-500',
];

export default function AIEvolution() {
  const [entries, setEntries] = useState<EvolutionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('ALL');
  const [selfLearning, setSelfLearning] = useState(true);
  const [togglingLearning, setTogglingLearning] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EvolutionEntry | null>(null);

  useEffect(() => {
    loadData();
    loadSelfLearning();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('ai_evolution')
      .select('*')
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

  async function loadSelfLearning() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'self_learning')
      .maybeSingle();
    if (data) {
      setSelfLearning(data.value === 'enabled');
    }
  }

  async function toggleSelfLearning() {
    setTogglingLearning(true);
    const newValue = !selfLearning ? 'enabled' : 'disabled';
    await supabase.from('settings').upsert(
      { key: 'self_learning', value: newValue },
      { onConflict: 'key' }
    );
    setSelfLearning(!selfLearning);
    setTogglingLearning(false);
  }

  const filtered = (() => {
    let result = entries;
    if (filterAgent !== 'ALL') {
      result = result.filter((e) => e.agent_name === filterAgent);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.agent_name.toLowerCase().includes(q) ||
          (e.reason || '').toLowerCase().includes(q)
      );
    }
    return result;
  })();

  const agentNames = Array.from(new Set(entries.map((e) => e.agent_name)));
  const totalImprovements = entries.reduce((sum, e) => sum + e.performance_gain, 0);
  const avgGain = entries.length > 0 ? Math.round(totalImprovements / entries.length) : 0;
  const positiveCount = entries.filter((e) => e.performance_gain > 0).length;

  // Agent performance stats for bar chart
  const agentStats = agentNames.map((name, i) => {
    const agentEntries = entries.filter((e) => e.agent_name === name);
    const totalGain = agentEntries.reduce((s, e) => s + e.performance_gain, 0);
    const avg = agentEntries.length > 0 ? Math.round(totalGain / agentEntries.length) : 0;
    return { name, totalGain, avg, count: agentEntries.length, color: agentColors[i % agentColors.length] };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold">AI Evolution</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Self-Learning Mode</span>
          <button
            onClick={toggleSelfLearning}
            disabled={togglingLearning}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {selfLearning ? (
              <>
                <ToggleRight className="w-6 h-6 text-emerald-400" />
                <span className="text-emerald-400">Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-slate-500" />
                <span className="text-slate-500">Disabled</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{entries.length}</p>
          <p className="text-xs text-slate-500">Total Evolutions</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400">+{totalImprovements}</p>
          <p className="text-xs text-slate-500">Total Performance Gain</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400">{avgGain}</p>
          <p className="text-xs text-slate-500">Avg Gain / Evolution</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-violet-400">{positiveCount}</p>
          <p className="text-xs text-slate-500">Positive Improvements</p>
        </div>
      </div>

      {/* Agent Performance Chart */}
      {agentStats.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold">Agent Performance Improvement</h3>
          </div>
          <div className="space-y-3">
            {agentStats.map((stat) => {
              const maxGain = Math.max(...agentStats.map((s) => s.totalGain), 1);
              const barWidth = Math.max((stat.totalGain / maxGain) * 100, 2);
              return (
                <div key={stat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{stat.name}</span>
                      <span className="text-xs text-slate-500">({stat.count} evolutions)</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">+{stat.totalGain}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full bg-gradient-to-r ${stat.color} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by agent or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex-wrap">
          <button
            onClick={() => setFilterAgent('ALL')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filterAgent === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {agentNames.map((name) => (
            <button
              key={name}
              onClick={() => setFilterAgent(name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterAgent === name
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Evolution Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entries List */}
        <div className={`${selectedEntry ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3`}>
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`bg-slate-900 border rounded-2xl p-4 hover:border-slate-700 transition-all cursor-pointer ${
                selectedEntry?.id === entry.id ? 'border-blue-600/50 ring-1 ring-blue-600/20' : 'border-slate-800'
              }`}
              onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{entry.agent_name}</span>
                      <span className="flex items-center gap-1 text-xs">
                        {entry.performance_gain > 0 ? (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <ArrowUpRight className="w-3 h-3" /> +{entry.performance_gain}
                          </span>
                        ) : entry.performance_gain < 0 ? (
                          <span className="flex items-center gap-0.5 text-red-400">
                            <ArrowDownRight className="w-3 h-3" /> {entry.performance_gain}
                          </span>
                        ) : (
                          <span className="text-slate-500">±0</span>
                        )}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-xs text-slate-400 line-clamp-2">{entry.reason}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.created_at).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No evolution entries found.</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedEntry && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 self-start sticky top-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Evolution Detail</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-500 hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-500">Agent</span>
                <p className="text-sm font-medium">{selectedEntry.agent_name}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Performance Gain</span>
                <p className={`text-lg font-bold ${selectedEntry.performance_gain > 0 ? 'text-emerald-400' : selectedEntry.performance_gain < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {selectedEntry.performance_gain > 0 ? '+' : ''}{selectedEntry.performance_gain}
                </p>
              </div>
              {selectedEntry.reason && (
                <div>
                  <span className="text-xs text-slate-500">Reason</span>
                  <p className="text-sm text-slate-300">{selectedEntry.reason}</p>
                </div>
              )}
              {selectedEntry.old_prompt && (
                <div>
                  <span className="text-xs text-slate-500 mb-1 block">Old Prompt (first 300 chars)</span>
                  <pre className="text-xs text-slate-400 bg-slate-800/80 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                    {selectedEntry.old_prompt.slice(0, 300)}{selectedEntry.old_prompt.length > 300 ? '...' : ''}
                  </pre>
                </div>
              )}
              {selectedEntry.new_prompt && (
                <div>
                  <span className="text-xs text-slate-500 mb-1 block">New Prompt (first 300 chars)</span>
                  <pre className="text-xs text-slate-300 bg-slate-800/80 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                    {selectedEntry.new_prompt.slice(0, 300)}{selectedEntry.new_prompt.length > 300 ? '...' : ''}
                  </pre>
                </div>
              )}
              <div>
                <span className="text-xs text-slate-500">Timestamp</span>
                <p className="text-sm">{new Date(selectedEntry.created_at).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
