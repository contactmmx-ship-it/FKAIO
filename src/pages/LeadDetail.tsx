import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Star, Clock, Calendar,
  FileText, MessageSquare, Activity, Edit, Check, Plus, Trash2, Brain,
  Upload, Download, Image, File, ShieldCheck, ShieldAlert, Loader2, ChevronDown
} from 'lucide-react';

const stages = [
  'Inquiry', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal Sent',
  'Negotiation', 'Registration Fee', 'Agreement', 'Onboarding Fee', 'Onboarded', 'Lost'
];

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

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [newActivity, setNewActivity] = useState('');
  // BUG 3 FIX: Add meeting date/time state for user-pickable scheduling
  const [meetingDate, setMeetingDate] = useState('');
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [loading, setLoading] = useState(true);
  // Document system state
  const [docType, setDocType] = useState('KYC');
  const [showDocForm, setShowDocForm] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  useState<Record<string, any[]>>({});

  const docTypes = ['KYC', 'Agreement', 'Proposal', 'Invoice', 'Payment Proof', 'Other'];

  const getDocIcon = (filename: string) => {
    const lower = (filename || '').toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return Image;
    if (lower.match(/\.(pdf)$/)) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    if (id) loadLead();
  }, [id]);

  async function loadLead() {
    setLoading(true);
    const { data: leadData } = await supabase.from('leads').select('*, brand:brand_id(*), consultant:assigned_to(*)').eq('id', id).single();
    const { data: actData } = await supabase.from('lead_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false });
    const { data: meetData } = await supabase.from('meetings').select('*').eq('lead_id', id).order('scheduled_at', { ascending: false });
    const { data: docData } = await supabase.from('documents').select('*').eq('lead_id', id).order('created_at', { ascending: false });
    const { data: brandsData } = await supabase.from('brands').select('*').eq('is_active', true);
    const { data: consultantsData } = await supabase.from('consultants').select('*').eq('is_active', true);

    setLead(leadData);
    setForm(leadData || {});
    setActivities(actData || []);
    setMeetings(meetData || []);
    setDocuments(docData || []);
    setBrands(brandsData || []);
    setConsultants(consultantsData || []);
    setLoading(false);
  }

  async function saveLead() {
    // BUG 3 FIX: Strip join objects (brand, consultant) and readonly fields before sending update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { brand, consultant, created_at, ...updateData } = form;
    const { error } = await supabase.from('leads').update(updateData).eq('id', id);
    if (!error) {
      setEditing(false);
      loadLead();
    }
  }

  async function moveStage(newStage: string) {
    await supabase.from('leads').update({ stage: newStage }).eq('id', id);
    await supabase.from('lead_activities').insert([{
      lead_id: id,
      type: 'stage_change',
      note: `Stage moved to ${newStage}`,
    }]);
    await supabase.from('ai_jobs').insert([{
      type: 'FOLLOW_UP',
      payload: { lead_id: id, new_stage: newStage },
      status: 'pending',
    }]);
    loadLead();
  }

  async function addActivity() {
    if (!newActivity.trim()) return;
    await supabase.from('lead_activities').insert([{
      lead_id: id,
      type: 'note',
      note: newActivity,
    }]);
    setNewActivity('');
    loadLead();
  }

  // BUG 3 FIX: Let user pick a date/time instead of hardcoding Date.now() + 86400000
  async function addMeeting() {
    if (!meetingDate) return;
    await supabase.from('meetings').insert([{
      lead_id: id,
      scheduled_at: new Date(meetingDate).toISOString(),
      status: 'Scheduled',
      notes: 'Meeting scheduled',
    }]);
    setMeetingDate('');
    setShowMeetingForm(false);
    loadLead();
  }

  async function addDocument() {
    setShowDocForm(false);
    const { data: doc } = await supabase.from('documents').insert([{
      lead_id: id,
      type: docType,
      status: 'Pending',
      notes: 'Awaiting upload',
    }]).select().single();
    if (doc) {
      loadLead();
    }
  }

  async function uploadFile(docId: string, file: File) {
    setUploadingDoc(docId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/document-engine`;

      // Get signed upload URL
      const { data: urlData } = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({
          action: 'upload_url',
          lead_id: id,
          filename: file.name,
          document_type: documents.find(d => d.id === docId)?.type || 'Other',
          document_id: docId,
        }),
      }).then(r => r.json());

      if (!urlData?.upload_url) {
        alert('Failed to get upload URL');
        setUploadingDoc(null);
        return;
      }

      // Upload file to storage using the signed URL
      const uploadRes = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (uploadRes.ok) {
        await supabase.from('documents').update({
          url: urlData.storage_path,
          file_url: urlData.public_url,
          file_size: file.size,
          status: 'Pending',
          notes: `${file.name} (${formatFileSize(file.size)})`,
        }).eq('id', docId);
        loadLead();
      } else {
        alert('File upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload error');
    }
    setUploadingDoc(null);
  }

  async function downloadDoc(doc: any) {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Delete this document permanently?')) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/document-engine`;
    await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      body: JSON.stringify({ action: 'delete', document_id: docId }),
    });
    loadLead();
  }

  async function verifyDoc(docId: string) {
    await supabase.from('documents').update({ status: 'Verified' }).eq('id', docId);
    loadLead();
  }

  async function rejectDoc(docId: string) {
    await supabase.from('documents').update({ status: 'Rejected' }).eq('id', docId);
    loadLead();
  }

  const fileInputRefs: Record<string, any> = {};
  const triggerUpload = (docId: string) => {
    fileInputRefs[docId]?.click();
  };

  async function deleteLead() {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    navigate('/leads');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <User className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">Lead not found</p>
          <button onClick={() => navigate('/leads')} className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 inline mr-1" /> Back to Leads
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/leads')} className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-lg font-bold text-white">
              {lead.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold">{lead.name}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>{lead.city}{lead.state ? `, ${lead.state}` : ''}</span>
                <span>·</span>
                <span>{lead.source || 'Website'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(!editing)} className="px-3 py-2 text-sm text-blue-400 hover:text-blue-300 font-medium border border-blue-500/30 rounded-xl hover:bg-blue-500/10 transition-all">
            <Edit className="w-4 h-4 inline mr-1" /> {editing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={deleteLead} className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Score & Stage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-400">Lead Score</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${lead.lead_score > 70 ? 'bg-emerald-500' : lead.lead_score > 40 ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${lead.lead_score}%` }} />
            </div>
            <span className="text-2xl font-bold">{lead.lead_score}</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-400">Pipeline Stage</h3>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${stageBadgeColors[lead.stage] || ''}`}>{lead.stage}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-400">Next Follow-up</h3>
          </div>
          <p className="text-lg font-semibold text-white">
            {lead.next_followup ? new Date(lead.next_followup).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not scheduled'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
        {['overview', 'activities', 'meetings', 'documents', 'ai'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Lead Details</h3>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-slate-500 mb-1">Name</label><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Mobile</label><input value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-slate-500 mb-1">Email</label><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">City</label><input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" /></div>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Brand</label>
                  <select value={form.brand_id || ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                    <option value="">No Brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Assigned To</label>
                  <select value={form.assigned_to || ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                    <option value="">Unassigned</option>
                    {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Notes</label><textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" /></div>
                <div className="flex gap-3">
                  <button onClick={saveLead} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all">Save Changes</button>
                  <button onClick={() => { setEditing(false); setForm(lead); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-slate-500" /> <span className="text-slate-400">{lead.mobile || '—'}</span></div>
                  <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-slate-500" /> <span className="text-slate-400">{lead.email || '—'}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-slate-500" /> <span className="text-slate-400">{lead.city || '—'}</span></div>
                  <div className="flex items-center gap-2 text-sm"><span className="text-xs font-semibold text-slate-500 uppercase">State</span> <span className="text-slate-400">{lead.state || '—'}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm"><span className="text-xs font-semibold text-slate-500 uppercase">Brand</span> <span className="text-slate-400">{lead.brand?.name || '—'}</span></div>
                  <div className="flex items-center gap-2 text-sm"><span className="text-xs font-semibold text-slate-500 uppercase">Consultant</span> <span className="text-slate-400">{lead.consultant?.name || '—'}</span></div>
                </div>
                <div className="flex items-center gap-2 text-sm"><span className="text-xs font-semibold text-slate-500 uppercase">Investment</span> <span className="text-slate-400">{lead.investment_capacity || '—'}</span></div>
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-500 uppercase mb-1">Notes</p>
                  <p className="text-sm text-slate-400">{lead.notes || 'No notes'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Stage Timeline</h3>
            <div className="space-y-3">
              {stages.map((stage, index) => {
                const currentIndex = stages.indexOf(lead.stage);
                const isCurrent = stage === lead.stage;
                const isCompleted = index < currentIndex;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <div className={`flex-1 text-sm font-medium ${isCurrent ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>{stage}</div>
                    {isCurrent && !editing && (
                      <div className="flex items-center gap-1">
                        {currentIndex > 0 && <button onClick={() => moveStage(stages[currentIndex - 1])} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><ArrowLeft className="w-3 h-3" /></button>}
                        {currentIndex < stages.length - 1 && <button onClick={() => moveStage(stages[currentIndex + 1])} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><ArrowLeft className="w-3 h-3 rotate-180" /></button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Activities</h3>
          </div>
          <div className="flex gap-2 mb-4">
            <input value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Add a note or activity..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            <button onClick={addActivity} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">{a.type.charAt(0).toUpperCase()}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{a.note || 'No note'}</p>
                  <p className="text-xs text-slate-500 mt-1">{a.type} · {new Date(a.created_at).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No activities yet. Add your first note.</p>}
          </div>
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-semibold">Meetings</h3>
            </div>
            {/* BUG 3 FIX: Toggle a date picker form instead of blindly scheduling tomorrow */}
            {!showMeetingForm ? (
              <button onClick={() => setShowMeetingForm(true)} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all"><Plus className="w-4 h-4 inline mr-1" /> Schedule</button>
            ) : (
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                <button onClick={addMeeting} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all">Confirm</button>
                <button onClick={() => { setShowMeetingForm(false); setMeetingDate(''); }} className="px-3 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors">Cancel</button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-violet-400" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('en-IN') : 'Not scheduled'}</p>
                  <p className="text-xs text-slate-500">{m.status} · {m.notes || 'No notes'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.status === 'Scheduled' ? 'bg-blue-500/20 text-blue-400' : m.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{m.status}</span>
              </div>
            ))}
            {meetings.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No meetings scheduled. Click Schedule to add one.</p>}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Documents</h3>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{documents.filter(d => d.status !== 'Deleted').length}</span>
            </div>
            <div className="flex items-center gap-2">
              {!showDocForm ? (
                <button onClick={() => setShowDocForm(true)} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">
                  <Plus className="w-4 h-4" /> Add Document
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                    {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={addDocument} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all">Create</button>
                  <button onClick={() => setShowDocForm(false)} className="px-3 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors">Cancel</button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {documents.filter(d => d.status !== 'Deleted').map((d) => {
              const DocIcon = d.file_url ? getDocIcon(d.url || d.file_url) : FileText;
              const isExpanded = expandedDoc === d.id;
              const isUploading = uploadingDoc === d.id;
              return (
                <div key={d.id} className="border border-slate-800 rounded-xl overflow-hidden transition-all">
                  <div className="flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${d.file_url ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                      ) : (
                        <DocIcon className={`w-5 h-5 ${d.file_url ? 'text-emerald-400' : 'text-slate-500'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{d.type} Document</p>
                        {d.version > 1 && <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">v{d.version}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{d.notes || 'Awaiting upload'}</span>
                        {d.file_size && <span>· {formatFileSize(d.file_size)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        d.status === 'Verified' ? 'bg-emerald-500/20 text-emerald-400' :
                        d.status === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                        d.status === 'Rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>{d.status}</span>

                      {!d.file_url && (
                        <>
                          <input
                            ref={(el) => { if (el) fileInputRefs[d.id] = el; }}
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(d.id, f); e.target.value = ''; }}
                          />
                          <button onClick={() => triggerUpload(d.id)} className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 transition-all" title="Upload file">
                            <Upload className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {d.file_url && (
                        <button onClick={() => downloadDoc(d)} className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 transition-all" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {d.status === 'Pending' && (
                        <button onClick={() => verifyDoc(d.id)} className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 transition-all" title="Verify">
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                      {d.status === 'Pending' && (
                        <button onClick={() => rejectDoc(d.id)} className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-all" title="Reject">
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteDoc(d.id)} className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setExpandedDoc(isExpanded ? null : d.id)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-all" title="Details">
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Image/PDF Preview */}
                  {d.file_url && d.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) && (
                    <div className="px-3 pb-3">
                      <img src={d.file_url} alt={d.type} className="h-32 w-auto rounded-lg border border-slate-700 object-cover" />
                    </div>
                  )}

                  {/* Version History / Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-800 space-y-2">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-slate-500">Created:</span> <span className="text-slate-300 ml-1">{new Date(d.created_at).toLocaleString('en-IN')}</span></div>
                        <div><span className="text-slate-500">Type:</span> <span className="text-slate-300 ml-1">{d.type}</span></div>
                        <div><span className="text-slate-500">Version:</span> <span className="text-slate-300 ml-1">{d.version || 1}</span></div>
                        <div><span className="text-slate-500">Status:</span> <span className="text-slate-300 ml-1">{d.status}</span></div>
                        {d.file_size && <div><span className="text-slate-500">Size:</span> <span className="text-slate-300 ml-1">{formatFileSize(d.file_size)}</span></div>}
                        {d.file_url && <div><span className="text-slate-500">URL:</span> <span className="text-blue-400 ml-1 truncate block max-w-[200px]">{d.file_url}</span></div>}
                      </div>
                      <div className="text-xs text-slate-500 pt-1">
                        <span className="font-medium text-slate-400">Version History</span>
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>v{d.version || 1} — Uploaded {new Date(d.created_at).toLocaleDateString('en-IN')} · {d.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {documents.filter(d => d.status !== 'Deleted').length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No documents yet. Add your first document.</p>
            )}
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold">AI Agent Actions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { type: 'QUALIFY_LEAD', label: 'Re-qualify Lead', icon: Star },
              { type: 'FOLLOW_UP', label: 'Trigger Follow-up', icon: MessageSquare },
              { type: 'SCHEDULE_MEETING', label: 'Schedule Meeting', icon: Calendar },
              { type: 'GENERATE_PROPOSAL', label: 'Generate Proposal', icon: FileText },
            ].map((action) => (
              <button
                key={action.type}
                onClick={async () => {
                  await supabase.from('ai_jobs').insert([{
                    type: action.type,
                    payload: { lead_id: lead.id },
                    status: 'pending',
                  }]);
                  alert(`AI Job created: ${action.label}`);
                }}
                className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-800 rounded-xl hover:border-cyan-500/30 hover:bg-slate-800 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center"><action.icon className="w-5 h-5 text-cyan-400" /></div>
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-slate-500">Create AI job</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}