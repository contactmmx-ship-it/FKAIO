import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCircle, Trash2, AlertTriangle, Info, Zap, Wifi, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { usePagination } from '../hooks/usePagination';
import EmptyState from '../components/EmptyState';

const typeIcons: Record<string, any> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  alert: Zap,
};

const typeColors: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  alert: 'bg-red-500/20 text-red-400',
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Realtime: notifications INSERT for current user
  const handleNotificationInsert = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      setNotifications((prev) => [payload.new, ...prev]);
      // Brief toast-style highlight
      setHighlightId(payload.new.id);
      setTimeout(() => setHighlightId(null), 2000);
    }
  }, []);

  // Realtime: notifications UPDATE for read status
  const handleNotificationUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' && payload.new) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n))
      );
    }
  }, []);

  const { isConnected: insertConnected } = useSupabaseRealtime({
    table: 'notifications',
    event: 'INSERT',
    filter: user ? `user_id=eq.${user.id}` : undefined,
    callback: handleNotificationInsert,
    enabled: !!user,
  });

  const { isConnected: updateConnected } = useSupabaseRealtime({
    table: 'notifications',
    event: 'UPDATE',
    filter: user ? `user_id=eq.${user.id}` : undefined,
    callback: handleNotificationUpdate,
    enabled: !!user,
  });

  // Pagination
  const { currentPage, totalPages, nextPage, prevPage, goToPage, paginatedData, startIndex, endIndex } = usePagination({
    totalItems: notifications.length,
    pageSize: 20,
  });

  const paginatedNotifications = paginatedData(notifications);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    loadNotifications();
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    loadNotifications();
  }

  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    loadNotifications();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const rtConnected = insertConnected || updateConnected;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Notifications</h2>
          {rtConnected && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              <Wifi className="w-3 h-3" /> Live
            </div>
          )}
        </div>
        {notifications.some((n) => !n.read) && (
          <button onClick={markAllRead} className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium border border-blue-500/30 rounded-xl hover:bg-blue-500/10 transition-all">
            Mark All Read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {paginatedNotifications.map((n) => {
          const Icon = typeIcons[n.type] || Info;
          const isHighlighted = highlightId === n.id;
          return (
            <div
              key={n.id}
              className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                isHighlighted
                  ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                  : n.read
                  ? 'border-slate-800 opacity-70'
                  : 'border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColors[n.type] || typeColors.info}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${n.read ? 'text-slate-500' : 'text-white'}`}>{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {!n.read && (
                        <button onClick={() => markRead(n.id)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-all" title="Mark read">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteNotification(n.id)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">{new Date(n.created_at).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll see notifications when leads, jobs, and activities update."
          />
        )}
      </div>

      {/* Pagination */}
      {notifications.length > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing {startIndex + 1}-{endIndex} of {notifications.length} notifications
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
    </div>
  );
}