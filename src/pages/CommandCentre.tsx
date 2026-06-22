import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Brain, Zap, Activity, TrendingUp, Target, MessageSquare,
  Send, RefreshCw, CheckCircle, XCircle, Play,
  Settings, Sparkles, Cpu, Users,
  DollarSign, Globe
} from 'lucide-react';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';

const deptIcons: Record<string, any> = {
  SALES: TrendingUp,
  MARKETING: Globe,
  OPERATIONS: Settings,
  FINANCE: DollarSign,
  HR: Users,
  STRATEGY: Target,
};

const deptColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  SALES: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/30' },
  MARKETING: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', glow: 'shadow-pink-500/30' },
  OPERATIONS: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/30' },
  FINANCE: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/30' },
  HR: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-violet-500/30' },
  STRATEGY: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/30' },
};

const agentAvatars: Record<string, string> = {
  'Lead Hunter AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=hunter&colors=blue',
  'Lead Qualifier AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=qualifier&colors=teal',
  'Follow-up AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=followup&colors=indigo',
  'Meeting Scheduler AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=scheduler&colors=green',
  'Proposal AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=proposal&colors=purple',
  'Closer AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=closer&colors=red',
  'Content AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=content&colors=pink',
  'Social Media AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=social&colors=rose',
  'Ad Campaign AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=ads&colors=orange',
  'Video AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=video&colors=yellow',
  'SEO AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=seo&colors=lime',
  'Onboarding AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=onboard&colors=emerald',
  'Documentation AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=docs&colors=slate',
  'Compliance AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=compliance&colors=zinc',
  'Courier AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=courier&colors=stone',
  'Invoice AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=invoice&colors=amber',
  'Royalty AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=royalty&colors=gold',
  'Commission AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=commission&colors=yellow',
  'MIS AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=mis&colors=blue',
  'Recruitment AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=recruit&colors=violet',
  'Training AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=training&colors=fuchsia',
  'Performance AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=performance&colors=pink',
  'CEO AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=ceo&colors=cyan',
  'Territory AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=territory&colors=teal',
  'Brand AI': 'https://api.dicebear.com/7.x/bottts/svg?seed=brand&colors=indigo',
};

interface Agent {
  id: string;
  name: string;
  dept: string;
  task: string;
  description: string;
  prompt: string;
  is_active: boolean;
  total_tasks_completed: number;
  success_rate: number;
  last_active_at: string;
}

interface Activity {
  id: string;
  agent_id: string;
  activity_type: string;
  title: string;
  description: string;
  metadata: any;
  created_at: string;
  agent?: Agent;
}

interface Objective {
  id: string;
  agent_id: string;
  objective: string;
  target_value: number;
  current_value: number;
  unit: string;
  status: string;
  deadline: string;
}

interface Conversation {
  id: string;
  message: string;
  response: string;
  created_at: string;
  agent_id: string;
}

export default function CommandCentre() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatMessages, setChatMessages] = useState<Conversation[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [, setSystemHealth] = useState(95);
  const chatRef = useRef<HTMLDivElement>(null);

  // Realtime: agent_activity_log INSERT
  const handleActivityInsert = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      setActivities((prev) => [payload.new, ...prev].slice(0, 50));
    }
  }, []);

  // Realtime: ai_jobs UPDATE
  const handleJobUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' && payload.new) {
      // Update agent task status — we can show this as activity
      setActivities((prev) => {
        const newActivity: Activity = {
          id: `rt-job-${payload.new.id}-${Date.now()}`,
          agent_id: payload.new.agent_id || '',
          activity_type: 'status_change',
          title: `Job ${payload.new.type} → ${payload.new.status}`,
          description: `Job status updated from ${payload.old?.status} to ${payload.new.status}`,
          metadata: {},
          created_at: new Date().toISOString(),
        };
        return [newActivity, ...prev].slice(0, 50);
      });
    }
  }, []);

  const { isConnected: activityRtConnected } = useSupabaseRealtime({
    table: 'agent_activity_log',
    event: 'INSERT',
    callback: handleActivityInsert,
  });

  const { isConnected: jobRtConnected } = useSupabaseRealtime({
    table: 'ai_jobs',
    event: 'UPDATE',
    callback: handleJobUpdate,
  });

  const rtConnected = activityRtConnected || jobRtConnected;

  // Reduce poll interval when realtime is connected
  const pollInterval = rtConnected ? 10000 : 3000;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, pollInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, pollInterval]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (selectedAgent) {
      loadConversations(selectedAgent.id);
    }
  }, [selectedAgent]);

  async function loadData() {
    const { data: agentsData } = await supabase
      .from('ai_agents')
      .select('*')
      .order('dept')
      .order('name');

    const { data: activitiesData } = await supabase
      .from('agent_activity_log')
      .select('*, agent:agent_id(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: objectivesData } = await supabase
      .from('agent_objectives')
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: false });

    if (agentsData) setAgents(agentsData);
    if (activitiesData) setActivities(activitiesData);
    if (objectivesData) setObjectives(objectivesData);

    if (agentsData) {
      const activeCount = agentsData.filter(a => a.is_active).length;
      const health = Math.min(100, Math.round((activeCount / agentsData.length) * 100));
      setSystemHealth(health);
    }

    setLoading(false);
  }

  async function loadConversations(agentId: string) {
    const { data } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true })
      .limit(20);
    if (data) setChatMessages(data);
  }

  async function sendMessage() {
    if (!chatInput.trim() || !selectedAgent) return;

    const message = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { id: 'temp', message, response: '', created_at: new Date().toISOString(), agent_id: selectedAgent.id }]);

    try {
      const { data, error } = await supabase.functions.invoke('ai-engine', {
        body: { action: 'chat_with_agent', agent_id: selectedAgent.id, message },
      });

      if (error) throw error;
      const conversation = data?.conversation;
      if (conversation) {
        setChatMessages(prev => prev.map(m => m.id === 'temp' ? conversation : m));
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m => m.id === 'temp'
        ? { ...m, response: `[Error reaching AI engine: ${err instanceof Error ? err.message : 'unknown error'}]` }
        : m));
    }
  }

  async function triggerAgent(agent: Agent) {
    await supabase.functions.invoke('ai-engine', {
      body: {
        action: 'queue_job',
        type: agent.task,
        agent_id: agent.id,
        payload: { triggered_from_command_centre: true },
      },
    });

    await supabase.from('agent_activity_log').insert({
      agent_id: agent.id,
      activity_type: 'trigger',
      title: `Task triggered: ${agent.task}`,
      description: 'Manual trigger from Command Centre',
      metadata: { manual: true }
    });

    await supabase.functions.invoke('ai-engine', { body: { action: 'run_jobs' } });

    loadData();
  }

  const agentsByDept = agents.reduce((acc, agent) => {
    if (!acc[agent.dept]) acc[agent.dept] = [];
    acc[agent.dept].push(agent);
    return acc;
  }, {} as Record<string, Agent[]>);

  const recentActivity = activities.slice(0, 15);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            <Brain className="absolute inset-4 w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
          <p className="text-cyan-400 font-semibold">JARVIS INITIALIZING...</p>
          <p className="text-slate-500 text-sm mt-1">Connecting to AI Workforce</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-7 h-7 text-cyan-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              JARVIS COMMAND CENTRE
            </h1>
            <p className="text-slate-500 text-sm">Autonomous AI Organization Operating in Real-Time</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-400 font-semibold">All Systems Operational</span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${autoRefresh ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'}`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {rtConnected ? 'Live' : `${pollInterval / 1000}s Poll`}
          </button>
        </div>
      </div>

      {/* System Health Bars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.entries(agentsByDept).map(([dept, deptAgents]) => {
          const colors = deptColors[dept] || deptColors.STRATEGY;
          const Icon = deptIcons[dept] || Brain;
          const activeCount = deptAgents.filter(a => a.is_active).length;
          const completedTasks = deptAgents.reduce((sum, a) => sum + (a.total_tasks_completed || 0), 0);

          return (
            <div key={dept} className={`bg-slate-900 border ${colors.border} rounded-xl p-4 hover:shadow-lg ${colors.glow} transition-all`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${colors.text}`}>{dept}</p>
                  <p className="text-[10px] text-slate-500">{activeCount}/{deptAgents.length} Active</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Tasks Completed</span>
                  <span className="text-white font-semibold">{completedTasks}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.bg.replace('/20', '')} rounded-full transition-all`}
                    style={{ width: `${Math.min(100, completedTasks / 5)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                AI Workforce
              </h2>
              <span className="text-xs text-slate-500">{agents.length} Agents Online</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {agents.map((agent) => {
                const colors = deptColors[agent.dept] || deptColors.STRATEGY;
                const isSelected = selectedAgent?.id === agent.id;
                const avatar = agentAvatars[agent.name] || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.id}`;

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${isSelected ? `${colors.border} ${colors.bg}` : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'} hover:shadow-lg`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <img src={avatar} alt={agent.name} className="w-10 h-10 rounded-lg bg-slate-700" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{agent.name}</p>
                        <p className={`text-[10px] font-semibold ${colors.text} uppercase`}>{agent.dept}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mb-3 line-clamp-2">{agent.description}</p>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono">{agent.task}</span>
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        <span>{agent.total_tasks_completed || 0}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); triggerAgent(agent); }}
                      className={`mt-3 w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`}
                    >
                      <Play className="w-3 h-3" /> Trigger Task
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Objectives */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                Active Objectives
              </h2>
              <span className="text-xs text-slate-500">{objectives.length} objectives</span>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {objectives.slice(0, 10).map((obj) => {
                const agent = agents.find(a => a.id === obj.agent_id);
                const progress = obj.target_value > 0 ? (obj.current_value / obj.target_value) * 100 : 0;

                return (
                  <div key={obj.id} className="p-3 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate">{obj.objective}</p>
                      <span className={`text-xs font-semibold ${progress >= 100 ? 'text-emerald-400' : progress >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{agent?.name || 'Unknown Agent'}</span>
                      <span>{obj.current_value}/{obj.target_value} {obj.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel - Activity + Chat */}
        <div className="space-y-4">
          {/* Live Activity Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Live Activity
              </h2>
              {rtConnected && (
                <div className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">Realtime</span>
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentActivity.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No activity yet. Agents are standing by.
                </div>
              )}
              {recentActivity.map((activity, idx) => {
                const agent = agents.find(a => a.id === activity.agent_id);
                const colors = deptColors[agent?.dept || 'STRATEGY'];
                const isNew = idx === 0;

                return (
                  <div
                    key={activity.id}
                    className={`p-3 rounded-xl transition-all ${isNew ? 'bg-slate-800 border border-slate-700' : 'bg-slate-800/50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${colors?.bg || 'bg-slate-700'} flex items-center justify-center flex-shrink-0`}>
                        {activity.activity_type === 'chat' ? (
                          <MessageSquare className={`w-4 h-4 ${colors?.text || 'text-slate-400'}`} />
                        ) : activity.activity_type === 'trigger' ? (
                          <Play className={`w-4 h-4 ${colors?.text || 'text-slate-400'}`} />
                        ) : (
                          <Zap className={`w-4 h-4 ${colors?.text || 'text-slate-400'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{activity.description}</p>
                        )}
                        <p className="text-[10px] text-slate-600 mt-1">
                          {agent?.name || 'System'} - {new Date(activity.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Chat */}
          {selectedAgent && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className={`p-4 ${deptColors[selectedAgent.dept]?.bg || 'bg-slate-800'} border-b border-slate-700`}>
                <div className="flex items-center gap-3">
                  <img
                    src={agentAvatars[selectedAgent.name] || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedAgent.id}`}
                    alt={selectedAgent.name}
                    className="w-10 h-10 rounded-lg bg-slate-700"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{selectedAgent.name}</p>
                    <p className={`text-xs ${deptColors[selectedAgent.dept]?.text || 'text-slate-400'}`}>
                      {selectedAgent.dept} Department
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div ref={chatRef} className="h-[250px] overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Start a conversation with {selectedAgent.name}
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className="space-y-2">
                    <div className="flex justify-end">
                      <div className="bg-blue-600/30 border border-blue-500/30 rounded-xl rounded-tr-none px-3 py-2 max-w-[80%]">
                        <p className="text-sm text-white">{msg.message}</p>
                      </div>
                    </div>
                    {msg.response && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl rounded-tl-none px-3 py-2 max-w-[80%]">
                          <p className="text-sm text-slate-300">{msg.response}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-800">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask your agent..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!chatInput.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl disabled:opacity-50 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}