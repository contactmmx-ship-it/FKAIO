import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus, User, MapPin } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function Meetings() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    lead_id: '',
    consultant_id: '',
    scheduled_at: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('*, lead:lead_id(name, city, mobile), consultant:consultant_id(id, name)')
      .order('scheduled_at', { ascending: false });
    const { data: leadsData } = await supabase.from('leads').select('id, name, city').eq('is_active', true);
    const { data: consultantsData } = await supabase.from('consultants').select('id, name').eq('is_active', true);
    setMeetings(meetingsData || []);
    setLeads(leadsData || []);
    setConsultants(consultantsData || []);
    setLoading(false);
  }

  async function addMeeting() {
    await supabase.from('meetings').insert([{
      lead_id: form.lead_id,
      consultant_id: form.consultant_id || null,
      scheduled_at: form.scheduled_at || null,
      notes: form.notes,
      status: 'Scheduled',
    }]);
    setShowAdd(false);
    setForm({ lead_id: '', consultant_id: '', scheduled_at: '', notes: '' });
    loadData();
  }

  async function updateStatus(meetingId: string, status: string) {
    await supabase.from('meetings').update({ status }).eq('id', meetingId);
    loadData();
  }

  const statusColors: Record<string, string> = {
    Scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    'No Show': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  const statusIcons: Record<string, any> = {
    Scheduled: Clock,
    Completed: CheckCircle,
    Cancelled: XCircle,
    'No Show': AlertCircle,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Meetings</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">
          <Plus className="w-4 h-4" /> Schedule Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meetings.map((meeting) => {
          const Icon = statusIcons[meeting.status] || Clock;
          return (
            <div key={meeting.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusColors[meeting.status].replace('text-', 'bg-').replace('border-', 'bg-').split(' ')[0]}`}>
                    <Icon className={`w-5 h-5 ${statusColors[meeting.status].split(' ')[1]}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{meeting.lead?.name || 'Unknown Lead'}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" /> {meeting.lead?.city || '—'}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[meeting.status]}`}>
                  {meeting.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>{meeting.scheduled_at ? new Date(meeting.scheduled_at).toLocaleString('en-IN') : 'Not scheduled'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4" />
                  <span>{meeting.consultant?.name || 'Unassigned'}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-800">{meeting.notes || 'No notes'}</div>
              </div>
              <div className="flex gap-2 mt-4">
                {meeting.status === 'Scheduled' && (
                  <>
                    <button onClick={() => updateStatus(meeting.id, 'Completed')} className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-600/30 transition-all">Complete</button>
                    <button onClick={() => updateStatus(meeting.id, 'No Show')} className="flex-1 py-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-xs font-semibold rounded-xl border border-amber-600/30 transition-all">No Show</button>
                    <button onClick={() => updateStatus(meeting.id, 'Cancelled')} className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-semibold rounded-xl border border-red-600/30 transition-all">Cancel</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {meetings.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Calendar}
              title="No meetings scheduled"
              description="Schedule your first meeting to start tracking client interactions."
              actionLabel="Schedule Meeting"
              onAction={() => setShowAdd(true)}
            />
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">Schedule Meeting</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Lead</label>
                <select value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">Select Lead</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Consultant</label>
                <select value={form.consultant_id} onChange={(e) => setForm({ ...form, consultant_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">Select Consultant</option>
                  {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Scheduled At</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium">Cancel</button>
                <button onClick={addMeeting} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">Schedule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}