import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users,
  Plus,
  XCircle,
  Search,
  Edit2,
  Phone,
  Mail,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react';

type Consultant = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
  brand_ids?: string[];
  brand_names?: string[];
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: 'RM',
  department: 'SALES',
};

const roles = ['Founder', 'OpsHead', 'BrandManager', 'RM', 'Accounts', 'Trainer'];

const roleColors: Record<string, string> = {
  Founder: 'bg-amber-500/20 text-amber-400',
  OpsHead: 'bg-red-500/20 text-red-400',
  BrandManager: 'bg-blue-500/20 text-blue-400',
  RM: 'bg-emerald-500/20 text-emerald-400',
  Accounts: 'bg-violet-500/20 text-violet-400',
  Trainer: 'bg-cyan-500/20 text-cyan-400',
};

const deptColors: Record<string, string> = {
  SALES: 'bg-blue-500/20 text-blue-400',
  MARKETING: 'bg-pink-500/20 text-pink-400',
  OPERATIONS: 'bg-emerald-500/20 text-emerald-400',
  FINANCE: 'bg-amber-500/20 text-amber-400',
  HR: 'bg-violet-500/20 text-violet-400',
};

export default function TeamManagement() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [filtered, setFiltered] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let result = consultants;
    if (filterRole !== 'ALL') {
      result = result.filter((c) => c.role === filterRole);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone || '').includes(q)
      );
    }
    setFiltered(result);
  }, [consultants, filterRole, search]);

  async function loadData() {
    setLoading(true);
    const { data: consultantsData } = await supabase
      .from('consultants')
      .select('*')
      .order('name');
    const { data: brandsData } = await supabase.from('brands').select('id, name').order('name');
    const { data: cbData } = await supabase.from('consultant_brands').select('consultant_id, brand_id');

    const brandMap = new Map<string, string>();
    (brandsData || []).forEach((b) => brandMap.set(b.id, b.name));

    const cbMap = new Map<string, string[]>();
    (cbData || []).forEach((cb) => {
      if (!cbMap.has(cb.consultant_id)) cbMap.set(cb.consultant_id, []);
      cbMap.get(cb.consultant_id)!.push(cb.brand_id);
    });

    const enriched = (consultantsData || []).map((c) => ({
      ...c,
      brand_ids: cbMap.get(c.id) || [],
      brand_names: (cbMap.get(c.id) || []).map((bid) => brandMap.get(bid) || bid),
    }));

    setConsultants(enriched);
    setBrands(brandsData || []);
    setFiltered(enriched);
    setLoading(false);
  }

  async function toggleActive(c: Consultant) {
    await supabase.from('consultants').update({ is_active: !c.is_active }).eq('id', c.id);
    loadData();
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedBrandIds([]);
    setShowModal(true);
  }

  function openEdit(c: Consultant) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone || '',
      role: c.role,
      department: c.department || 'SALES',
    });
    setSelectedBrandIds(c.brand_ids || []);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    if (!form.name || !form.email) {
      setMessage('Name and email are required.');
      setSaving(false);
      return;
    }
    if (editingId) {
      await supabase
        .from('consultants')
        .update({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
          department: form.department,
        })
        .eq('id', editingId);

      // Sync brand assignments
      await supabase.from('consultant_brands').delete().eq('consultant_id', editingId);
      if (selectedBrandIds.length > 0) {
        await supabase.from('consultant_brands').insert(
          selectedBrandIds.map((bid) => ({ consultant_id: editingId, brand_id: bid }))
        );
      }
      setMessage('Consultant updated successfully');
    } else {
      const { data: newConsultant } = await supabase
        .from('consultants')
        .insert([
          {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            role: form.role,
            department: form.department,
          },
        ])
        .select()
        .single();

      if (newConsultant && selectedBrandIds.length > 0) {
        await supabase.from('consultant_brands').insert(
          selectedBrandIds.map((bid) => ({ consultant_id: newConsultant.id, brand_id: bid }))
        );
      }
      setMessage('Consultant created successfully');
    }
    setTimeout(() => {
      setMessage('');
      setShowModal(false);
    }, 1500);
    setSaving(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this consultant? This cannot be undone.')) return;
    await supabase.from('consultant_brands').delete().eq('consultant_id', id);
    await supabase.from('consultants').delete().eq('id', id);
    loadData();
  }

  function toggleBrand(brandId: string) {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  }

  const roleList = ['ALL', ...roles];
  const activeCount = consultants.filter((c) => c.is_active).length;

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold">Team Management</h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
        >
          <Plus className="w-4 h-4" /> Add Consultant
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{consultants.length}</p>
          <p className="text-xs text-slate-500">Total Consultants</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-400">{consultants.length - activeCount}</p>
          <p className="text-xs text-slate-500">Inactive</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-cyan-400">{roles.length}</p>
          <p className="text-xs text-slate-500">Roles</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search consultants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex-wrap">
          {roleList.map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                filterRole === r
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Consultant List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-semibold">Consultant</th>
                <th className="text-left px-6 py-3 font-semibold">Role</th>
                <th className="text-left px-6 py-3 font-semibold">Dept</th>
                <th className="text-left px-6 py-3 font-semibold">Brands</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th className="text-left px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" /> {c.email}
                          </span>
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        roleColors[c.role] || 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {c.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        deptColors[c.department || ''] || 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {c.department}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(c.brand_names || []).length > 0 ? (
                        c.brand_names!.slice(0, 2).map((bn) => (
                          <span key={bn} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            {bn}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-600">None</span>
                      )}
                      {(c.brand_names || []).length > 2 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          +{c.brand_names!.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => toggleActive(c)}>
                      {c.is_active ? (
                        <ToggleRight className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-all border border-blue-600/30"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-all border border-red-600/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No consultants found.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">
                {editingId ? 'Edit Consultant' : 'Add Consultant'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {message && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> {message}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Full Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="john@company.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="SALES">Sales</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="OPERATIONS">Operations</option>
                  <option value="FINANCE">Finance</option>
                  <option value="HR">HR</option>
                </select>
              </div>

              {/* Brand Assignments */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">Brand Assignments</label>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto">
                  {brands.length === 0 ? (
                    <p className="text-xs text-slate-500">No brands available</p>
                  ) : (
                    <div className="space-y-2">
                      {brands.map((brand) => (
                        <label
                          key={brand.id}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBrandIds.includes(brand.id)}
                            onChange={() => toggleBrand(brand.id)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500/30"
                          />
                          <span className="text-sm text-slate-300">{brand.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
