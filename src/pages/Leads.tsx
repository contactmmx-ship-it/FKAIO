import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Plus, Search, Grid3X3, List, ArrowRight, ArrowLeft, User, Phone, MapPin, Star, Wifi, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { usePagination } from '../hooks/usePagination';
import { validateLeadForm } from '../utils/validation';
import EmptyState from '../components/EmptyState';

const stages = [
  'Inquiry', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal Sent',
  'Negotiation', 'Registration Fee', 'Agreement', 'Onboarding Fee', 'Onboarded', 'Lost'
];

const leadSources = [
  'Manual Entry', 'WhatsApp', 'Meta Lead Ads', 'LinkedIn Lead Gen', 'Website Form', 'Referral'
];

const sourceColors: Record<string, string> = {
  'WhatsApp': 'bg-green-500/20 text-green-400 border border-green-500/40',
  'Meta Lead Ads': 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
  'LinkedIn Lead Gen': 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
  'Manual Entry': 'bg-slate-500/20 text-slate-400 border border-slate-500/40',
  'Website Form': 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
  'Referral': 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
};

const stageColors: Record<string, string> = {
  Inquiry: 'border-blue-500/40 bg-blue-500/10',
  Contacted: 'border-slate-500/40 bg-slate-500/10',
  Qualified: 'border-cyan-500/40 bg-cyan-500/10',
  'Meeting Scheduled': 'border-violet-500/40 bg-violet-500/10',
  'Proposal Sent': 'border-pink-500/40 bg-pink-500/10',
  Negotiation: 'border-amber-500/40 bg-amber-500/10',
  'Registration Fee': 'border-emerald-500/40 bg-emerald-500/10',
  Agreement: 'border-teal-500/40 bg-teal-500/10',
  'Onboarding Fee': 'border-sky-500/40 bg-sky-500/10',
  Onboarded: 'border-green-500/40 bg-green-500/10',
  Lost: 'border-red-500/40 bg-red-500/10',
};

const stageBadgeColors: Record<string, string> = {
  Inquiry: 'bg-blue-500/20 text-blue-400',
  Contacted: 'bg-slate-500/20 text-slate-400',
  Qualified: 'bg-cyan-500/20 text-cyan-400',
  'Meeting Scheduled': 'bg-violet-500/20 text-violet-400',
  'Proposal Sent': 'bg-pink-500/20 text-pink-400',
  Negotiation: 'bg-amber-500/20 text-amber-400',
  'Registration Fee': 'bg-emerald-500/20 text-emerald-400',
  Agreement: 'bg-teal-500/20 text-teal-400',
  'Onboarding Fee': 'bg-sky-500/20 text-sky-400',
  Onboarded: 'bg-green-500/20 text-green-400',
  Lost: 'bg-red-500/20 text-red-400',
};

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    city: '',
    state: '',
    source: 'Manual Entry',
    brand_id: '',
    assigned_to: '',
    investment_capacity: '',
    notes: '',
  });

  // Realtime: leads INSERT, UPDATE, DELETE
  const handleLeadChange = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      setLeads((prev) => [payload.new, ...prev]);
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      setLeads((prev) => prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l)));
    } else if (payload.eventType === 'DELETE' && payload.old) {
      setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
    }
  }, []);

  const { isConnected: rtConnected } = useSupabaseRealtime({
    table: 'leads',
    event: '*',
    callback: handleLeadChange,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: leadsData } = await supabase.from('leads').select('*, brand:brand_id(*), consultant:assigned_to(*)').order('created_at', { ascending: false });
    const { data: brandsData } = await supabase.from('brands').select('*').eq('is_active', true);
    const { data: consultantsData } = await supabase.from('consultants').select('*').eq('is_active', true);
    setLeads(leadsData || []);
    setBrands(brandsData || []);
    setConsultants(consultantsData || []);
    setLoading(false);
  }

  async function addLead() {
    const errors = validateLeadForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const { data, error } = await supabase.from('leads').insert([form]).select().single();
    if (!error && data) {
      // Create AI job for qualification
      await supabase.from('ai_jobs').insert([{
        type: 'QUALIFY_LEAD',
        payload: { lead_id: data.id, lead_name: data.name, investment: data.investment_capacity, city: data.city },
        status: 'pending',
      }]);
      setShowAdd(false);
      setForm({
        name: '',
        mobile: '',
        email: '',
        city: '',
        state: '',
        source: 'Manual Entry',
        brand_id: '',
        assigned_to: '',
        investment_capacity: '',
        notes: '',
      });
      loadData();
    }
  }

  async function moveStage(leadId: string, newStage: string) {
    await supabase.from('leads').update({ stage: newStage }).eq('id', leadId);
    // Create activity
    await supabase.from('lead_activities').insert([{
      lead_id: leadId,
      type: 'stage_change',
      note: `Stage moved to ${newStage}`,
    }]);
    // Create AI job for follow-up
    await supabase.from('ai_jobs').insert([{
      type: 'FOLLOW_UP',
      payload: { lead_id: leadId, new_stage: newStage },
      status: 'pending',
    }]);
    loadData();
  }

  const filteredLeads = leads.filter((l) => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.city || '').toLowerCase().includes(search.toLowerCase()) || (l.mobile || '').includes(search);
    const matchStage = !filterStage || l.stage === filterStage;
    const matchBrand = !filterBrand || l.brand_id === filterBrand;
    const matchSource = !filterSource || (l.source || 'Manual Entry') === filterSource;
    return matchSearch && matchStage && matchBrand && matchSource;
  });

  // Pagination (list view only)
  const {
    currentPage, totalPages, nextPage, prevPage, goToPage, paginatedData, startIndex, endIndex,
  } = usePagination({ totalItems: filteredLeads.length, pageSize: 20 });

  const paginatedLeads = paginatedData(filteredLeads);

  // Reset page when filters change
  useEffect(() => {
    goToPage(1);
  }, [search, filterStage, filterBrand, filterSource]);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
          {rtConnected && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              <Wifi className="w-3 h-3" /> Live
            </div>
          )}
          <button onClick={() => setView('kanban')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'kanban' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}>
            <Grid3X3 className="w-4 h-4 inline mr-2" />Kanban
          </button>
          <button onClick={() => setView('list')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}>
            <List className="w-4 h-4 inline mr-2" />List
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name, city, mobile..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All Stages</option>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All Sources</option>
            {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-2 min-h-[400px]">
          {stages.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage);
            if (stageLeads.length === 0) return null;
            return (
              <div key={stage} className="min-w-[280px] flex flex-col">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-sm font-semibold text-slate-300">{stage}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                </div>
                <div className="space-y-2 flex-1">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className={`bg-slate-900 border rounded-xl p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all group cursor-pointer ${stageColors[stage] || 'border-slate-800'}`}>
                      <Link to={`/leads/${lead.id}`} className="block">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {lead.name.charAt(0)}
                            </div>
                            <p className="text-sm font-semibold group-hover:text-blue-400 transition-colors">{lead.name}</p>
                          </div>
                          {lead.lead_score > 70 && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.city}{lead.state ? `, ${lead.state}` : ''}</div>
                          <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.mobile || '—'}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${stageBadgeColors[stage]}`}>{lead.stage}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceColors[lead.source] || sourceColors['Manual Entry']}`}>{lead.source || 'Manual Entry'}</span>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-800/50">
                        {stages.indexOf(stage) > 0 && (
                          <button onClick={() => moveStage(lead.id, stages[stages.indexOf(stage) - 1])} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                        )}
                        {stages.indexOf(stage) < stages.length - 1 && (
                          <button onClick={() => moveStage(lead.id, stages[stages.indexOf(stage) + 1])} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors ml-auto">
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filteredLeads.length === 0 && (
            <div className="flex-1">
              <EmptyState
                icon={User}
                title="No leads found"
                description="Add your first lead or adjust filters."
                actionLabel="Add Lead"
                onAction={() => setShowAdd(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-semibold">Lead</th>
                    <th className="text-left px-6 py-3 font-semibold">Contact</th>
                    <th className="text-left px-6 py-3 font-semibold">Stage</th>
                    <th className="text-left px-6 py-3 font-semibold">Brand</th>
                    <th className="text-left px-6 py-3 font-semibold">Score</th>
                    <th className="text-left px-6 py-3 font-semibold">City</th>
                    <th className="text-left px-6 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3">
                        <Link to={`/leads/${lead.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {lead.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{lead.name}</p>
                            <p className="text-xs text-slate-500">{lead.source}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-slate-400">
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.mobile || '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{lead.email || '—'}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageBadgeColors[lead.stage] || ''}`}>{lead.stage}</span>
                      </td>
                      <td className="px-6 py-3 text-slate-400">{lead.brand?.name || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${lead.lead_score > 70 ? 'bg-emerald-500' : lead.lead_score > 40 ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${lead.lead_score}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{lead.lead_score}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-400">{lead.city}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          {stages.indexOf(lead.stage) > 0 && (
                            <button onClick={() => moveStage(lead.id, stages[stages.indexOf(lead.stage) - 1])} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {stages.indexOf(lead.stage) < stages.length - 1 && (
                            <button onClick={() => moveStage(lead.id, stages[stages.indexOf(lead.stage) + 1])} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredLeads.length === 0 && (
              <EmptyState
                icon={User}
                title="No leads found"
                description="Add your first lead or adjust filters."
                actionLabel="Add Lead"
                onAction={() => setShowAdd(true)}
              />
            )}
          </div>

          {/* Pagination */}
          {filteredLeads.length > 20 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing {startIndex + 1}-{endIndex} of {filteredLeads.length} leads
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
        </>
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">Add New Lead</h3>
              <button onClick={() => { setShowAdd(false); setFormErrors({}); }} className="text-slate-500 hover:text-white transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Name *</label>
                  <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormErrors((prev) => ({ ...prev, name: '' })); }} className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${formErrors.name ? 'border-red-500' : 'border-slate-700'}`} />
                  {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Mobile</label>
                  <input value={form.mobile} onChange={(e) => { setForm({ ...form, mobile: e.target.value }); setFormErrors((prev) => ({ ...prev, mobile: '' })); }} className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${formErrors.mobile ? 'border-red-500' : 'border-slate-700'}`} />
                  {formErrors.mobile && <p className="text-xs text-red-400 mt-1">{formErrors.mobile}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                  <input value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormErrors((prev) => ({ ...prev, email: '' })); }} className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${formErrors.email ? 'border-red-500' : 'border-slate-700'}`} />
                  {formErrors.email && <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">State</label>
                  <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Brand</label>
                  <select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    <option value="">Select Brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Assigned To</label>
                  <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    <option value="">Select Consultant</option>
                    {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Investment Capacity</label>
                <select value={form.investment_capacity} onChange={(e) => setForm({ ...form, investment_capacity: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  <option value="">Select Range</option>
                  <option>Below 5L</option>
                  <option>5L - 10L</option>
                  <option>10L - 25L</option>
                  <option>25L - 50L</option>
                  <option>50L - 1Cr</option>
                  <option>Above 1Cr</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowAdd(false); setFormErrors({}); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors">Cancel</button>
                <button onClick={addLead} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">Add Lead</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}