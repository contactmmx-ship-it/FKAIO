import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Brain, Play } from 'lucide-react';

const deptColors: Record<string, string> = {
  SALES: 'bg-blue-500/20 text-blue-400',
  MARKETING: 'bg-pink-500/20 text-pink-400',
  OPERATIONS: 'bg-emerald-500/20 text-emerald-400',
  FINANCE: 'bg-amber-500/20 text-amber-400',
  HR: 'bg-violet-500/20 text-violet-400',
  STRATEGY: 'bg-cyan-500/20 text-cyan-400',
};

export default function AIAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    const { data } = await supabase.from('ai_agents').select('*').order('dept');
    setAgents(data || []);
    setLoading(false);
  }

  async function triggerAgent(agent: any) {
    await supabase.from('ai_jobs').insert([{
      agent_id: agent.id,
      type: agent.task,
      payload: { triggered_manually: true, agent_name: agent.name },
      status: 'pending',
    }]);
    alert(`AI Job queued for: ${agent.name}`);
  }

  const depts = ['ALL', ...Array.from(new Set(agents.map((a) => a.dept)))];
  const filtered = selectedDept === 'ALL' ? agents : agents.filter((a) => a.dept === selectedDept);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {['SALES', 'MARKETING', 'OPERATIONS', 'FINANCE', 'HR', 'STRATEGY'].map((dept) => {
          const count = agents.filter((a) => a.dept === dept).length;
          return (
            <div key={dept} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center hover:border-slate-700 transition-all">
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className={`text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block ${deptColors[dept]}`}>{dept}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit flex-wrap">
        {depts.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDept(d)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${selectedDept === d ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer"
            onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center text-lg font-bold text-cyan-400">
                  {agent.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{agent.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${deptColors[agent.dept] || 'bg-slate-500/20 text-slate-400'}`}>{agent.dept}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{agent.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-mono">{agent.task}</span>
              <button
                onClick={(e) => { e.stopPropagation(); triggerAgent(agent); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-semibold rounded-lg transition-all border border-blue-600/30"
              >
                <Play className="w-3 h-3" /> Run
              </button>
            </div>

            {selectedAgent?.id === agent.id && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">System Prompt</p>
                <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/50 rounded-xl p-3">{agent.prompt}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No AI agents found. Run the seed migration.</p>
        </div>
      )}
    </div>
  );
}
