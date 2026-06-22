import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Brain,
  Search,
  Database,
  Clock,
  Star,
  ChevronDown,
  XCircle,
  Sparkles,
  MessageSquare,
  Settings,
  CheckCircle,
} from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  dept: string;
  task: string;
};

type MemoryEntry = {
  id: string;
  agent_id: string;
  memory_type: string;
  content: Record<string, unknown>;
  importance: number;
  created_at: string;
  expires_at: string | null;
  agent?: { id: string; name: string; dept: string; task: string } | null;
};

const typeIcons: Record<string, any> = {
  context: Database,
  learning: Sparkles,
  preference: Settings,
  conversation: MessageSquare,
  task_result: CheckCircle,
};

const typeColors: Record<string, string> = {
  context: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  learning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  preference: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  conversation: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  task_result: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const deptColors: Record<string, string> = {
  SALES: 'bg-blue-500/20 text-blue-400',
  MARKETING: 'bg-pink-500/20 text-pink-400',
  OPERATIONS: 'bg-emerald-500/20 text-emerald-400',
  FINANCE: 'bg-amber-500/20 text-amber-400',
  HR: 'bg-violet-500/20 text-violet-400',
  STRATEGY: 'bg-cyan-500/20 text-cyan-400',
};

export default function AgentMemory() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedMemory, setSelectedMemory] = useState<MemoryEntry | null>(null);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      loadMemories();
    }
  }, [selectedAgentId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function loadAgents() {
    setLoading(true);
    const { data } = await supabase.from('ai_agents').select('id, name, dept, task').order('name');
    setAgents(data || []);
    if (data && data.length > 0 && !selectedAgentId) {
      setSelectedAgentId(data[0].id);
    }
    setLoading(false);
  }

  async function loadMemories() {
    setLoadingMemories(true);
    const { data } = await supabase
      .from('agent_memory')
      .select('*, agent:ai_agents(id, name, dept, task)')
      .eq('agent_id', selectedAgentId)
      .order('created_at', { ascending: false });
    setMemories(data || []);
    setLoadingMemories(false);
  }

  async function deleteMemory(id: string) {
    if (!confirm('Delete this memory entry?')) return;
    await supabase.from('agent_memory').delete().eq('id', id);
    loadMemories();
  }

  const filtered = (() => {
    let result = memories;
    if (filterType !== 'ALL') {
      result = result.filter((m) => m.memory_type === filterType);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => JSON.stringify(m.content).toLowerCase().includes(q));
    }
    return result;
  })();

  const types = ['ALL', ...Array.from(new Set(memories.map((m) => m.memory_type)))];
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

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
      <div className="flex items-center gap-3">
        <Brain className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold">Agent Memory</h2>
      </div>

      {/* Agent Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-slate-400">Select Agent:</label>
        <div className="relative">
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setSelectedMemory(null);
            }}
            className="appearance-none bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-white min-w-[250px] focus:outline-none focus:border-blue-600/50 transition-colors"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} — {agent.dept}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
        {selectedAgent && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${deptColors[selectedAgent.dept] || 'bg-slate-500/20 text-slate-400'}`}>
            {selectedAgent.dept}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {types.filter((t) => t !== 'ALL').map((t) => {
          const count = memories.filter((m) => m.memory_type === t).length;
          const Icon = typeIcons[t] || Database;
          return (
            <div key={t} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-2 ${typeColors[t]?.replace('bg-', 'text-').split(' ')[0]?.replace('/20', '') || 'text-slate-400'}`} />
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">{t}</p>
            </div>
          );
        })}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search memory content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all capitalize ${
                filterType === t
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Memory List */}
      {loadingMemories ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Memory Cards */}
          <div className={`${selectedMemory ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3`}>
            {filtered.map((memory) => {
              const Icon = typeIcons[memory.memory_type] || Database;
              return (
                <div
                  key={memory.id}
                  className={`bg-slate-900 border rounded-2xl p-4 hover:border-slate-700 transition-all cursor-pointer ${
                    selectedMemory?.id === memory.id ? 'border-blue-600/50 ring-1 ring-blue-600/20' : 'border-slate-800'
                  }`}
                  onClick={() => setSelectedMemory(selectedMemory?.id === memory.id ? null : memory)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${typeColors[memory.memory_type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColors[memory.memory_type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                            {memory.memory_type}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {new Date(memory.created_at).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-2">
                          {typeof memory.content === 'string'
                            ? memory.content
                            : JSON.stringify(memory.content).slice(0, 150)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Star className="w-3 h-3" />
                        {memory.importance}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMemory(memory.id);
                        }}
                        className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500">No memory entries found.</p>
              </div>
            )}
          </div>

          {/* Memory Detail */}
          {selectedMemory && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 self-start sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Memory Detail</h3>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="text-slate-500 hover:text-white"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-500">Type</span>
                  <p className="text-sm font-medium capitalize">{selectedMemory.memory_type}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Source Agent</span>
                  <p className="text-sm font-medium">{selectedMemory.agent?.name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Importance</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 h-2 rounded-full"
                        style={{ width: `${selectedMemory.importance}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{selectedMemory.importance}/100</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Created</span>
                  <p className="text-sm">
                    {new Date(selectedMemory.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                {selectedMemory.expires_at && (
                  <div>
                    <span className="text-xs text-slate-500">Expires</span>
                    <p className="text-sm text-amber-400">
                      {new Date(selectedMemory.expires_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-500 mb-1 block">Content</span>
                  <pre className="text-xs text-slate-300 bg-slate-800/80 rounded-xl p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words">
                    {typeof selectedMemory.content === 'string'
                      ? selectedMemory.content
                      : JSON.stringify(selectedMemory.content, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
