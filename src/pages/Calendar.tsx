import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock,
  User, Check, XCircle, AlertTriangle, Loader2, CalendarDays,
  CalendarRange, LayoutGrid, Users
} from 'lucide-react';

type MeetingWithLead = {
  id: string;
  lead_id: string;
  consultant_id: string | null;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  lead?: { id: string; name: string; city: string | null; state: string | null };
  consultant?: { id: string; name: string };
};

type ViewMode = 'month' | 'week' | 'day';

const statusConfig: Record<string, { color: string; dot: string; border: string; bg: string }> = {
  Scheduled: { color: 'text-blue-400', dot: 'bg-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  Completed: { color: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  Cancelled: { color: 'text-red-400', dot: 'bg-red-500', border: 'border-red-500/30', bg: 'bg-red-500/10' },
  'No Show': { color: 'text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Generate hours array for week/day views
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function Calendar() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<MeetingWithLead[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterConsultant, setFilterConsultant] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithLead | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalTime, setModalTime] = useState('10:00');
  const [modalLeadId, setModalLeadId] = useState('');
  const [modalConsultantId, setModalConsultantId] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [savingMeeting, setSavingMeeting] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('*, lead:lead_id(id, name, city, state), consultant:consultant_id(id, name)')
      .order('scheduled_at', { ascending: false });
    const { data: consultantsData } = await supabase.from('consultants').select('*').eq('is_active', true);
    const { data: leadsData } = await supabase.from('leads').select('id, name').eq('is_active', true);
    setMeetings(meetingsData || []);
    setConsultants(consultantsData || []);
    setLeads(leadsData || []);
    setLoading(false);
  }

  // Filtered meetings based on consultant filter
  const filteredMeetings = useMemo(() => {
    if (!filterConsultant) return meetings;
    return meetings.filter(m => m.consultant_id === filterConsultant);
  }, [meetings, filterConsultant]);

  // Navigation
  function goToday() { setCurrentDate(new Date()); }

  function goPrev() {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  }

  function goNext() {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  }

  function getHeaderText() {
    if (view === 'month') return `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    if (view === 'week') {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${formatDate(start)} — ${formatDate(end)}`;
    }
    return formatDate(currentDate);
  }

  // Get Monday of current week
  function getWeekStart(d: Date) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  // Open modal for creating meeting
  function openCreateMeeting(date?: Date) {
    setModalDate(date || currentDate);
    setModalTime('10:00');
    setModalLeadId('');
    setModalConsultantId('');
    setModalNotes('');
    setShowMeetingModal(true);
  }

  // Save meeting
  async function saveMeeting() {
    if (!modalDate || !modalLeadId) return;
    setSavingMeeting(true);
    const scheduledAt = new Date(modalDate);
    const [h, m] = modalTime.split(':').map(Number);
    scheduledAt.setHours(h, m, 0, 0);
    await supabase.from('meetings').insert({
      lead_id: modalLeadId,
      consultant_id: modalConsultantId || null,
      scheduled_at: scheduledAt.toISOString(),
      status: 'Scheduled',
      notes: modalNotes || 'Meeting scheduled',
    });
    setShowMeetingModal(false);
    setSavingMeeting(false);
    loadData();
  }

  // Update meeting status
  async function updateMeetingStatus(meetingId: string, status: string) {
    await supabase.from('meetings').update({ status }).eq('id', meetingId);
    setSelectedMeeting(null);
    loadData();
  }

  // Get meetings for a specific day
  const getMeetingsForDay = useCallback((date: Date) => {
    return filteredMeetings.filter(m => {
      if (!m.scheduled_at) return false;
      const d = new Date(m.scheduled_at);
      return isSameDay(d, date);
    });
  }, [filteredMeetings]);

  // ==================== MONTH VIEW ====================
  function renderMonthView() {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevMonthDays - i);
      cells.push({ date: d, isCurrentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentYear, currentMonth, i);
      cells.push({ date: d, isCurrentMonth: true });
    }
    // Next month days to fill 6 rows (42 cells)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      cells.push({ date: d, isCurrentMonth: false });
    }

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-800">
          {DAY_NAMES.map(day => (
            <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const dayMeetings = getMeetingsForDay(cell.date);
            const today = isToday(cell.date);
            return (
              <div
                key={idx}
                onClick={() => openCreateMeeting(cell.date)}
                className={`min-h-[100px] border-b border-r border-slate-800/50 p-1.5 cursor-pointer hover:bg-slate-800/30 transition-colors ${
                  !cell.isCurrentMonth ? 'bg-slate-900/50' : ''
                } ${idx % 7 === 0 ? 'border-l-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    today ? 'bg-blue-600 text-white font-bold' : cell.isCurrentMonth ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {cell.date.getDate()}
                  </span>
                  {dayMeetings.length > 0 && (
                    <span className="text-[10px] text-slate-500">{dayMeetings.length}</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayMeetings.slice(0, 3).map(m => {
                    const cfg = statusConfig[m.status] || statusConfig.Scheduled;
                    return (
                      <div
                        key={m.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedMeeting(m); }}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${cfg.bg} ${cfg.color} border ${cfg.border} truncate cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="truncate">{m.lead?.name || 'Meeting'}</span>
                        {m.scheduled_at && (
                          <span className="shrink-0 opacity-60">{new Date(m.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        )}
                      </div>
                    );
                  })}
                  {dayMeetings.length > 3 && (
                    <div className="text-[10px] text-slate-500 px-1.5">+{dayMeetings.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== WEEK VIEW ====================
  function renderWeekView() {
    const weekStart = getWeekStart(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b border-slate-800">
          <div className="px-2 py-3 text-center text-xs font-semibold text-slate-500">
            <Clock className="w-4 h-4 mx-auto mb-1" />
            IST
          </div>
          {weekDays.map((day, i) => (
            <div key={i} className={`px-2 py-2 text-center border-l border-slate-800/50 ${isToday(day) ? 'bg-blue-600/5' : ''}`}>
              <div className="text-[10px] text-slate-500 uppercase">{DAY_NAMES[i]}</div>
              <div className={`text-lg font-bold mt-0.5 ${isToday(day) ? 'text-blue-400' : 'text-white'}`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="max-h-[600px] overflow-y-auto">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-800/30 min-h-[48px]">
              <div className="px-2 py-1 text-right text-[10px] text-slate-500 border-r border-slate-800/50 flex items-start justify-end pt-2">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, i) => {
                const dayMeetings = getMeetingsForDay(day);
                const hourMeetings = dayMeetings.filter(m => {
                  if (!m.scheduled_at) return false;
                  const h = new Date(m.scheduled_at).getHours();
                  return h === hour;
                });
                return (
                  <div
                    key={i}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(hour, 0, 0, 0);
                      openCreateMeeting(d);
                    }}
                    className={`border-l border-slate-800/50 p-0.5 cursor-pointer hover:bg-slate-800/20 transition-colors ${isToday(day) ? 'bg-blue-600/5' : ''}`}
                  >
                    {hourMeetings.map(m => {
                      const cfg = statusConfig[m.status] || statusConfig.Scheduled;
                      return (
                        <div
                          key={m.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedMeeting(m); }}
                          className={`px-1.5 py-1 rounded-lg text-[10px] font-medium ${cfg.bg} ${cfg.color} border ${cfg.border} mb-0.5 cursor-pointer hover:opacity-80 transition-opacity`}
                        >
                          <div className="font-semibold truncate">{m.lead?.name || 'Meeting'}</div>
                          <div className="opacity-60">{formatTime(m.scheduled_at!)}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==================== DAY VIEW ====================
  function renderDayView() {
    const dayMeetings = getMeetingsForDay(currentDate);

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Day header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">{DAY_NAMES_FULL[currentDate.getDay()]}</div>
            <div className="text-sm text-slate-400">{MONTH_NAMES[currentMonth]} {currentDay}, {currentYear}</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{dayMeetings.length} meeting{dayMeetings.length !== 1 ? 's' : ''} scheduled</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="max-h-[600px] overflow-y-auto">
          {HOURS.map(hour => {
            const hourMeetings = dayMeetings.filter(m => {
              if (!m.scheduled_at) return false;
              return new Date(m.scheduled_at).getHours() === hour;
            });
            return (
              <div
                key={hour}
                className="flex border-b border-slate-800/30 min-h-[56px] hover:bg-slate-800/10 transition-colors"
              >
                <div className="w-20 px-3 py-2 text-right text-xs text-slate-500 shrink-0 border-r border-slate-800/50 flex items-start justify-end pt-3">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div
                  className="flex-1 p-1.5 cursor-pointer"
                  onClick={() => {
                    const d = new Date(currentDate);
                    d.setHours(hour, 0, 0, 0);
                    openCreateMeeting(d);
                  }}
                >
                  {hourMeetings.map(m => {
                    const cfg = statusConfig[m.status] || statusConfig.Scheduled;
                    return (
                      <div
                        key={m.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedMeeting(m); }}
                        className={`flex items-center gap-3 p-3 rounded-xl ${cfg.bg} border ${cfg.border} cursor-pointer hover:opacity-80 transition-opacity mb-1`}
                      >
                        <div className={`w-1 h-10 rounded-full ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${cfg.color}`}>{m.lead?.name || 'Meeting'}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(m.scheduled_at!)}</span>
                            {m.consultant?.name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{m.consultant.name}</span>}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          {m.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={goPrev} className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={goToday} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-all">
            Today
          </button>
          <button onClick={goNext} className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
          <h2 className="text-xl font-bold ml-2">{getHeaderText()}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Consultant Filter */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <select
              value={filterConsultant}
              onChange={(e) => setFilterConsultant(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="">All Consultants</option>
              {consultants.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
            <button
              onClick={() => setView('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${view === 'month' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />Month
            </button>
            <button
              onClick={() => setView('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${view === 'week' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              <CalendarRange className="w-3.5 h-3.5" />Week
            </button>
            <button
              onClick={() => setView('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${view === 'day' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              <CalendarDays className="w-3.5 h-3.5" />Day
            </button>
          </div>

          {/* Add Meeting */}
          <button
            onClick={() => openCreateMeeting()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
          >
            <Plus className="w-4 h-4" /> New Meeting
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: 'Scheduled', status: 'Scheduled', icon: CalendarIcon, color: 'blue' },
          { label: 'Completed', status: 'Completed', icon: Check, color: 'emerald' },
          { label: 'Cancelled', status: 'Cancelled', icon: XCircle, color: 'red' },
          { label: 'No Show', status: 'No Show', icon: AlertTriangle, color: 'amber' },
        ] as const).map(({ label, status, icon: Icon, color }) => {
          const count = filteredMeetings.filter(m => m.status === status).length;
          const colorMap: Record<string, string> = {
            blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
            emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
            red: 'from-red-500/20 to-red-600/10 border-red-500/20',
            amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
          };
          const iconColorMap: Record<string, string> = {
            blue: 'text-blue-400 bg-blue-500/20',
            emerald: 'text-emerald-400 bg-emerald-500/20',
            red: 'text-red-400 bg-red-500/20',
            amber: 'text-amber-400 bg-amber-500/20',
          };
          return (
            <div key={status} className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-4`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColorMap[color]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Views */}
      {view === 'month' && renderMonthView()}
      {view === 'week' && renderWeekView()}
      {view === 'day' && renderDayView()}

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedMeeting(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-semibold">Meeting Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">ID: {selectedMeeting.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setSelectedMeeting(null)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Lead */}
              <button
                onClick={() => { setSelectedMeeting(null); navigate(`/leads/${selectedMeeting.lead_id}`); }}
                className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                  {(selectedMeeting.lead?.name || 'M').charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selectedMeeting.lead?.name || 'Unknown Lead'}</p>
                  <p className="text-xs text-slate-500">
                    {selectedMeeting.lead?.city}{selectedMeeting.lead?.state ? `, ${selectedMeeting.lead.state}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              {/* Meeting Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">
                    {selectedMeeting.scheduled_at
                      ? new Date(selectedMeeting.scheduled_at).toLocaleString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Not scheduled'}
                  </span>
                </div>
                {selectedMeeting.consultant?.name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{selectedMeeting.consultant.name}</span>
                  </div>
                )}
                {selectedMeeting.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-xs font-semibold text-slate-500 uppercase mt-0.5">Notes</span>
                    <span className="text-slate-400">{selectedMeeting.notes}</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Status</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  statusConfig[selectedMeeting.status]?.border || statusConfig.Scheduled.border
                } ${
                  statusConfig[selectedMeeting.status]?.bg || statusConfig.Scheduled.bg
                } ${
                  statusConfig[selectedMeeting.status]?.color || statusConfig.Scheduled.color
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedMeeting.status]?.dot || statusConfig.Scheduled.dot}`} />
                  {selectedMeeting.status}
                </span>
              </div>

              {/* Status Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                {selectedMeeting.status === 'Scheduled' && (
                  <>
                    <button
                      onClick={() => updateMeetingStatus(selectedMeeting.id, 'Completed')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all"
                    >
                      <Check className="w-4 h-4" /> Complete
                    </button>
                    <button
                      onClick={() => updateMeetingStatus(selectedMeeting.id, 'No Show')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-sm font-medium rounded-xl transition-all border border-amber-600/30"
                    >
                      <AlertTriangle className="w-4 h-4" /> No Show
                    </button>
                    <button
                      onClick={() => updateMeetingStatus(selectedMeeting.id, 'Cancelled')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-medium rounded-xl transition-all border border-red-600/30"
                    >
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                  </>
                )}
                {selectedMeeting.status === 'No Show' && (
                  <button
                    onClick={() => updateMeetingStatus(selectedMeeting.id, 'Completed')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all"
                  >
                    <Check className="w-4 h-4" /> Mark Complete
                  </button>
                )}
                {selectedMeeting.status === 'Cancelled' && (
                  <button
                    onClick={() => updateMeetingStatus(selectedMeeting.id, 'Scheduled')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all"
                  >
                    <CalendarIcon className="w-4 h-4" /> Reschedule
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowMeetingModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">Schedule Meeting</h3>
              <button onClick={() => setShowMeetingModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Lead</label>
                <select value={modalLeadId} onChange={(e) => setModalLeadId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">Select Lead</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={modalDate ? modalDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => { const d = e.target.value ? new Date(e.target.value) : null; setModalDate(d); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Time</label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Assigned Consultant</label>
                <select value={modalConsultantId} onChange={(e) => setModalConsultantId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">Unassigned</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <textarea value={modalNotes} onChange={(e) => setModalNotes(e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" placeholder="Meeting notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowMeetingModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium">Cancel</button>
                <button
                  onClick={saveMeeting}
                  disabled={savingMeeting || !modalLeadId}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {savingMeeting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {savingMeeting ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}