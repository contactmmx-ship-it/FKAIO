import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, DollarSign, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    lead_id: '',
    type: 'Registration Fee',
    amount: '',
    due_date: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('*, lead:lead_id(name)')
      .order('created_at', { ascending: false });
    const { data: leadsData } = await supabase.from('leads').select('id, name').eq('is_active', true);
    setInvoices(invoicesData || []);
    setLeads(leadsData || []);
    setLoading(false);
  }

  async function addInvoice() {
    await supabase.from('invoices').insert([{
      lead_id: form.lead_id,
      type: form.type,
      amount: parseFloat(form.amount) || 0,
      due_date: form.due_date || null,
      status: 'Pending',
    }]);
    setShowAdd(false);
    setForm({ lead_id: '', type: 'Registration Fee', amount: '', due_date: '' });
    loadData();
  }

  async function updateStatus(invoiceId: string, status: string) {
    await supabase.from('invoices').update({ status }).eq('id', invoiceId);
    loadData();
  }

  const statusColors: Record<string, string> = {
    Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const statusIcons: Record<string, any> = {
    Pending: Clock,
    Paid: CheckCircle,
    Overdue: AlertTriangle,
  };

  const totalPending = invoices.filter((i) => i.status === 'Pending').reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'Paid').reduce((sum, i) => sum + (i.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-amber-400" /></div>
            <div>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-amber-400">₹{totalPending.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-400" /></div>
            <div>
              <p className="text-sm text-slate-500">Paid</p>
              <p className="text-2xl font-bold text-emerald-400">₹{totalPaid.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">
          <Plus className="w-4 h-4" /> Add Invoice
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-semibold">Invoice</th>
                <th className="text-left px-6 py-3 font-semibold">Lead</th>
                <th className="text-left px-6 py-3 font-semibold">Type</th>
                <th className="text-left px-6 py-3 font-semibold">Amount</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th className="text-left px-6 py-3 font-semibold">Due</th>
                <th className="text-left px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const Icon = statusIcons[invoice.status] || Clock;
                return (
                  <tr key={invoice.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">{invoice.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-400">{invoice.lead?.name || '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{invoice.type}</td>
                    <td className="px-6 py-3 font-semibold">₹{(invoice.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[invoice.status]}`}>
                        <Icon className="w-3 h-3" /> {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-6 py-3">
                      {invoice.status === 'Pending' && (
                        <button onClick={() => updateStatus(invoice.id, 'Paid')} className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs rounded-lg border border-emerald-600/30 transition-all">Mark Paid</button>
                      )}
                      {invoice.status === 'Pending' && (
                        <button onClick={() => updateStatus(invoice.id, 'Overdue')} className="ml-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded-lg border border-red-600/30 transition-all">Overdue</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invoices.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Add your first invoice to start tracking payments."
            actionLabel="Add Invoice"
            onAction={() => setShowAdd(true)}
          />
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">Add Invoice</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white"><XCircle className="w-5 h-5" /></button>
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
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
                  <option>Registration Fee</option>
                  <option>Onboarding Fee</option>
                  <option>Royalty</option>
                  <option>Training Fee</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" placeholder="50000" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Due Date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium">Cancel</button>
                <button onClick={addInvoice} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30">Add Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}