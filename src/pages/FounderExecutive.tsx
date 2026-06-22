import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Brain, Sparkles, Target, TrendingUp, DollarSign,
  AlertTriangle, Send, RefreshCw, BookOpen,
  BarChart3, Zap, MessageSquare, Loader2, Sun, Calendar
} from 'lucide-react';

// ── Local Types ──────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  confidence?: number | null;
  created_at: string;
};

type KeyMetric = {
  label: string;
  value: string;
  icon: any;
  color: string;
  bgColor: string;
};

type QuickAction = {
  label: string;
  prompt: string;
  icon: any;
  color: string;
};

// ── API Helper ──────────────────────────────────────────────

async function queryFounderExecutive(
  message: string,
  sessionId: string,
  userId: string
): Promise<{ content: string; sources: string[]; confidence: number }> {
  const { data, error } = await supabase.functions.invoke('founder-executive', {
    body: { message, session_id: sessionId, user_id: userId },
  });

  if (error) throw error;
  return {
    content: data?.content || data?.answer || 'No response generated.',
    sources: data?.sources || [],
    confidence: data?.confidence ?? null,
  };
}

// ── Component ───────────────────────────────────────────────

export default function FounderExecutive() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // Key metrics
  const [metrics, setMetrics] = useState<KeyMetric[]>([
    { label: "Today's Revenue", value: '—', icon: DollarSign, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    { label: 'Active Leads', value: '—', icon: Target, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { label: 'Pending Approvals', value: '—', icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    { label: 'Upcoming Meetings', value: '—', icon: Calendar, color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load metrics
  useEffect(() => {
    loadMetrics();
    loadMessages();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Today's revenue from invoices paid today
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'Paid')
        .gte('created_at', today);

      const todayRevenue = (invoicesData || []).reduce((sum, i) => sum + (i.amount || 0), 0);

      // Active leads
      const { count: activeLeads } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('stage', 'eq', 'Lost');

      // Pending approvals
      const { count: pendingApprovals } = await supabase
        .from('approval_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Upcoming meetings
      const { count: upcomingMeetings } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString());

      setMetrics([
        {
          label: "Today's Revenue",
          value: '₹' + todayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
          icon: DollarSign,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20',
        },
        {
          label: 'Active Leads',
          value: String(activeLeads || 0),
          icon: Target,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
        },
        {
          label: 'Pending Approvals',
          value: String(pendingApprovals || 0),
          icon: AlertTriangle,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/20',
        },
        {
          label: 'Upcoming Meetings',
          value: String(upcomingMeetings || 0),
          icon: Calendar,
          color: 'text-violet-400',
          bgColor: 'bg-violet-500/20',
        },
      ]);
    } catch (err: any) {
      console.error('[FounderExecutive] Error loading metrics:', err);
    }
  }

  async function loadMessages() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('founder_executive_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (err) {
        // If table doesn't exist, start fresh
        if (err.code === '42P01') {
          setMessages([]);
          setLoading(false);
          return;
        }
        throw err;
      }
      setMessages((data as ChatMessage[]) || []);
    } catch (err: any) {
      console.error('[FounderExecutive] Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      // Save user message
      try {
        await supabase.from('founder_executive_messages').insert([{
          session_id: sessionId,
          user_id: user?.id || null,
          role: 'user',
          content: text.trim(),
        }]);
      } catch {
        // Ignore save errors, continue with the query
      }

      const response = await queryFounderExecutive(text.trim(), sessionId, user?.id || '');

      const assistantMsg: ChatMessage = {
        id: `local_resp_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        sources: response.sources,
        confidence: response.confidence,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Save assistant message
      try {
        await supabase.from('founder_executive_messages').insert([{
          session_id: sessionId,
          user_id: user?.id || null,
          role: 'assistant',
          content: response.content,
          sources: response.sources,
          confidence: response.confidence,
        }]);
      } catch {
        // Ignore save errors
      }
    } catch (err: any) {
      console.error('[FounderExecutive] Error sending message:', err);
      setError(err.message || 'Failed to get response');
      setMessages((prev) => [
        ...prev,
        {
          id: `local_err_${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to process your request. Please try again.'}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const quickActions: QuickAction[] = [
    { label: 'Morning Brief', prompt: 'Give me a morning executive briefing: today\'s revenue, active leads status, pending approvals, and upcoming meetings.', icon: Sun, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' },
    { label: 'Revenue Review', prompt: 'Show me a revenue analysis: this month vs last month, by brand, top performing segments, and collection rate.', icon: BarChart3, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' },
    { label: 'Pipeline Status', prompt: 'Show me the current lead pipeline: leads by stage, conversion rates, top hot leads, and bottleneck analysis.', icon: Target, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' },
    { label: 'Milestones', prompt: 'Show me strategic milestones: quarterly targets progress, key OKR status, and upcoming deadlines.', icon: TrendingUp, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px]">
      {/* Top Section: Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 shrink-0">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${metric.bgColor} flex items-center justify-center shrink-0`}>
                <metric.icon className={`w-4 h-4 ${metric.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{metric.label}</p>
                <p className={`text-lg font-bold ${metric.color} leading-tight`}>{metric.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden min-h-0">
        {/* Chat Header */}
        <div className="bg-slate-800/50 border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                Executive AI Assistant
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[10px] text-slate-500">RAG-grounded responses with knowledge base integration</p>
            </div>
          </div>
          <button
            onClick={() => { loadMessages(); loadMetrics(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 text-xs font-medium rounded-lg transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : messages.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Executive Command Center</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Ask anything about your business — revenue, leads, operations, strategy. 
                The AI assistant has access to your full knowledge base and real-time data.
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs text-slate-600">
                <Zap className="w-3 h-3" />
                Powered by RAG with real-time Supabase data
              </div>
            </div>
          ) : (
            <>
              {error && !messages.length && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 justify-center">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                    {/* Assistant avatar */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                          <Brain className="w-3 h-3 text-blue-400" />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">AI Assistant</span>
                      </div>
                    )}
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {/* AI metadata: sources + confidence */}
                    {msg.role === 'assistant' && (msg.sources?.length || msg.confidence) && (
                      <div className="mt-2 space-y-2">
                        {/* Confidence */}
                        {msg.confidence != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Confidence</span>
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    msg.confidence >= 0.8
                                      ? 'bg-emerald-500'
                                      : msg.confidence >= 0.5
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.round(msg.confidence * 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono font-medium ${
                                msg.confidence >= 0.8
                                  ? 'text-emerald-400'
                                  : msg.confidence >= 0.5
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}>
                                {Math.round(msg.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">
                              <BookOpen className="w-3 h-3" />
                              Sources
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((source, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                >
                                  <BookOpen className="w-2.5 h-2.5" />
                                  {source}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Timestamp */}
                    <p className={`text-[10px] text-slate-600 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {sending && (
                <div className="flex justify-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                        <Brain className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">AI Assistant</span>
                    </div>
                    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick Actions + Input */}
        <div className="border-t border-slate-800 bg-slate-800/30 p-4 shrink-0">
          {/* Quick Actions */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-medium transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your business..."
              disabled={sending}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}