import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Clock, CheckCircle, XCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, User, Zap, FileText, CreditCard,
  Scale, Tag, ArrowUp, MessageSquare, X
} from 'lucide-react';

// ── Local Types ──────────────────────────────────────────────

type ApprovalItem = {
  id: string;
  action_type: 'refund' | 'contract' | 'payment' | 'legal' | 'pricing' | 'escalation';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected';
  entity_type: string;
  entity_id: string | null;
  entity_description: string;
  request_data: Record<string, unknown> | null;
  requested_by: string | null;
  requested_by_type: 'agent' | 'user' | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Tab = 'pending' | 'approved' | 'rejected' | 'all';

const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  refund:    { label: 'Refund',    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',    icon: ArrowUp },
  contract:  { label: 'Contract',  color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',  icon: FileText },
  payment:   { label: 'Payment',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',        icon: CreditCard },
  legal:     { label: 'Legal',     color: 'bg-red-500/20 text-red-400 border-red-500/30',           icon: Scale },
  pricing:   { label: 'Pricing',   color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',  icon: Tag },
  escalation:{ label: 'Escalation',color: 'bg-red-500/20 text-red-400 border-red-500/30 font-bold',  icon: AlertTriangle },
};

const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string; bold?: boolean }> = {
  low:      { label: 'Low',      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  medium:   { label: 'Medium',   color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  high:     { label: 'High',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30', bold: true },
};

function timeSince(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ApprovalQueue() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded items for JSON preview
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Review notes per item
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // Confirm approve dialog
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);

  // Reject state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadApprovals();
  }, [activeTab]);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('approval_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setApprovals((data as ApprovalItem[]) || []);
    } catch (err: any) {
      console.error('[ApprovalQueue] Error loading approvals:', err);
      setError(err.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  function toggleExpanded(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApprove(id: string) {
    setConfirmApprove(id);
  }

  async function confirmApproval() {
    if (!confirmApprove) return;
    setActionLoading(true);
    try {
      const notes = reviewNotes[confirmApprove] || null;
      const { error } = await supabase
        .from('approval_queue')
        .update({
          status: 'approved',
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', confirmApprove);

      if (error) throw error;
      setConfirmApprove(null);
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[confirmApprove];
        return next;
      });
      loadApprovals();
    } catch (err: any) {
      console.error('[ApprovalQueue] Approve error:', err);
      alert('Failed to approve: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }

  function handleReject(id: string) {
    setRejectTarget(id);
    setRejectNotes(reviewNotes[id] || '');
    setRejectError(null);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (!rejectNotes.trim()) {
      setRejectError('Review notes are required for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('approval_queue')
        .update({
          status: 'rejected',
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
          review_notes: rejectNotes.trim(),
        })
        .eq('id', rejectTarget);

      if (error) throw error;
      setRejectTarget(null);
      setRejectNotes('');
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[rejectTarget];
        return next;
      });
      loadApprovals();
    } catch (err: any) {
      console.error('[ApprovalQueue] Reject error:', err);
      alert('Failed to reject: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'pending', label: 'Pending', icon: Clock, count: pendingCount },
    { key: 'approved', label: 'Approved', icon: CheckCircle },
    { key: 'rejected', label: 'Rejected', icon: XCircle },
    { key: 'all', label: 'All', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Pending Badge */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-400">
              {pendingCount} Pending Approval{pendingCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-500">Items awaiting your review</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No {activeTab === 'all' ? '' : activeTab + ' '}approvals found</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
          {approvals.map((item) => {
            const actionConfig = ACTION_TYPE_CONFIG[item.action_type] || ACTION_TYPE_CONFIG.payment;
            const riskConfig = RISK_LEVEL_CONFIG[item.risk_level] || RISK_LEVEL_CONFIG.low;
            const ActionIcon = actionConfig.icon;
            const isExpanded = expandedItems.has(item.id);
            const isPending = item.status === 'pending';

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                  item.status === 'approved'
                    ? 'border-emerald-500/20'
                    : item.status === 'rejected'
                    ? 'border-red-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Type + Entity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${actionConfig.color}`}>
                        <ActionIcon className="w-3 h-3" />
                        {actionConfig.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${riskConfig.color} ${riskConfig.bold ? 'font-bold' : ''}`}>
                        <Zap className="w-3 h-3" />
                        {riskConfig.label} Risk
                      </span>
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3 animate-pulse" />
                          Pending
                        </span>
                      )}
                      {!isPending && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          item.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {item.status === 'approved' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {item.status}
                        </span>
                      )}
                    </div>

                    {/* Entity info */}
                    <p className="text-sm font-semibold text-white mb-1">{item.entity_description}</p>
                    <p className="text-xs text-slate-500">
                      {item.entity_type}
                      {item.entity_id && <span className="text-slate-600 ml-1 font-mono">({item.entity_id.slice(0, 8)})</span>}
                    </p>

                    {/* Requested by + time */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {item.requested_by || 'Unknown'}
                        {item.requested_by_type && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-medium">
                            {item.requested_by_type}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeSince(item.created_at)}
                      </span>
                    </div>

                    {/* Review notes (for approved/rejected) */}
                    {item.review_notes && !isPending && (
                      <div className="mt-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                          <MessageSquare className="w-3 h-3" />
                          Review Notes
                        </div>
                        <p className="text-xs text-slate-300">{item.review_notes}</p>
                        {item.reviewed_at && (
                          <p className="text-[10px] text-slate-600 mt-1.5">
                            Reviewed {timeSince(item.reviewed_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions (for pending items) */}
                  {isPending && (
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs font-semibold rounded-lg transition-all border border-emerald-600/30"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-semibold rounded-lg transition-all border border-red-600/30"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Request Data */}
                {item.request_data && Object.keys(item.request_data).length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleExpanded(item.id)}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Request Data
                    </button>
                    {isExpanded && (
                      <div className="mt-2 bg-slate-800/70 rounded-xl p-3 border border-slate-700/50 max-h-60 overflow-y-auto">
                        <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(item.request_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Review Notes Textarea (for pending) */}
                {isPending && (
                  <div className="mt-3">
                    <label className="block text-xs text-slate-500 mb-1">
                      <MessageSquare className="w-3 h-3 inline mr-1" />
                      Review Notes (optional for approve, required for reject)
                    </label>
                    <textarea
                      value={reviewNotes[item.id] || ''}
                      onChange={(e) => setReviewNotes({ ...reviewNotes, [item.id]: e.target.value })}
                      placeholder="Add notes for this decision..."
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Approve Confirmation Modal ────────────────────── */}
      {confirmApprove && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Confirm Approval</h3>
              <p className="text-sm text-slate-400 mb-6">
                Are you sure you want to approve this action? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setConfirmApprove(null)}
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm text-slate-400 hover:text-white font-medium bg-slate-800 border border-slate-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApproval}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal (requires notes) ─────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold">Reject Action</h3>
              </div>
              <button onClick={() => { setRejectTarget(null); setRejectError(null); }} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {rejectError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4" />
                  {rejectError}
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                  Review Notes <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => { setRejectNotes(e.target.value); setRejectError(null); }}
                  placeholder="Explain why this action is being rejected..."
                  rows={4}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setRejectTarget(null); setRejectError(null); }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={actionLoading || !rejectNotes.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}