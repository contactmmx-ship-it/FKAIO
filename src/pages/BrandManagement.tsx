import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Tag,
  Plus,
  XCircle,
  Search,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  Edit2,
  Building2,
  DollarSign,
  Percent,
} from 'lucide-react';

type Brand = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  investment_range: string | null;
  royalty: string | null;
  sector: string | null;
  is_active: boolean;
  created_at: string;
};

const emptyForm = {
  name: '',
  slug: '',
  type: 'franchise',
  description: '',
  investment_range: '',
  royalty: '',
  sector: '',
};

const typeColors: Record<string, string> = {
  franchise: 'bg-blue-500/20 text-blue-400',
  consulting: 'bg-emerald-500/20 text-emerald-400',
  visa: 'bg-violet-500/20 text-violet-400',
};

const sectorColors: Record<string, string> = {
  Consulting: 'bg-cyan-500/20 text-cyan-400',
  Immigration: 'bg-violet-500/20 text-violet-400',
  QSR: 'bg-amber-500/20 text-amber-400',
  Furniture: 'bg-pink-500/20 text-pink-400',
  Healthcare: 'bg-emerald-500/20 text-emerald-400',
  Education: 'bg-blue-500/20 text-blue-400',
  Retail: 'bg-orange-500/20 text-orange-400',
  Services: 'bg-rose-500/20 text-rose-400',
};

export default function BrandManagement() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filtered, setFiltered] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    let result = brands;
    if (filterType !== 'ALL') {
      result = result.filter((b) => b.type === filterType);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.sector || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [brands, filterType, search]);

  async function loadBrands() {
    setLoading(true);
    const { data } = await supabase.from('brands').select('*').order('name');
    setBrands(data || []);
    setFiltered(data || []);
    setLoading(false);
  }

  async function toggleActive(brand: Brand) {
    await supabase.from('brands').update({ is_active: !brand.is_active }).eq('id', brand.id);
    loadBrands();
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(brand: Brand) {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      slug: brand.slug,
      type: brand.type,
      description: brand.description || '',
      investment_range: brand.investment_range || '',
      royalty: brand.royalty || '',
      sector: brand.sector || '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    if (!form.name || !form.slug) {
      setMessage('Name and slug are required.');
      setSaving(false);
      return;
    }
    const payload = {
      name: form.name,
      slug: form.slug,
      type: form.type,
      description: form.description || null,
      investment_range: form.investment_range || null,
      royalty: form.royalty || null,
      sector: form.sector || null,
    };
    if (editingId) {
      await supabase.from('brands').update(payload).eq('id', editingId);
      setMessage('Brand updated successfully');
    } else {
      await supabase.from('brands').insert([payload]);
      setMessage('Brand created successfully');
    }
    setTimeout(() => {
      setMessage('');
      setShowModal(false);
    }, 1500);
    setSaving(false);
    loadBrands();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this brand? This cannot be undone.')) return;
    await supabase.from('brands').delete().eq('id', id);
    loadBrands();
  }

  const types = ['ALL', ...Array.from(new Set(brands.map((b) => b.type)))];
  const activeCount = brands.filter((b) => b.is_active).length;
  const inactiveCount = brands.length - activeCount;

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
          <Tag className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold">Brand Management</h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
        >
          <Plus className="w-4 h-4" /> Add Brand
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{brands.length}</p>
          <p className="text-xs text-slate-500">Total Brands</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-400">{inactiveCount}</p>
          <p className="text-xs text-slate-500">Inactive</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-cyan-400">{types.length - 1}</p>
          <p className="text-xs text-slate-500">Brand Types</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all capitalize ${
                filterType === t
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Brand Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((brand) => (
          <div
            key={brand.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center text-lg font-bold text-cyan-400">
                  {brand.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{brand.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{brand.slug}</p>
                </div>
              </div>
              <button
                onClick={() => toggleActive(brand)}
                title={brand.is_active ? 'Deactivate' : 'Activate'}
              >
                {brand.is_active ? (
                  <ToggleRight className="w-6 h-6 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-500" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColors[brand.type] || 'bg-slate-500/20 text-slate-400'}`}>
                {brand.type}
              </span>
              {brand.sector && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sectorColors[brand.sector] || 'bg-slate-500/20 text-slate-400'}`}>
                  {brand.sector}
                </span>
              )}
            </div>

            {brand.description && (
              <p className="text-xs text-slate-500 line-clamp-2 mb-3">{brand.description}</p>
            )}

            <div className="space-y-2 mb-4">
              {brand.investment_range && (
                <div className="flex items-center gap-2 text-xs">
                  <DollarSign className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-400">{brand.investment_range}</span>
                </div>
              )}
              {brand.royalty && (
                <div className="flex items-center gap-2 text-xs">
                  <Percent className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-400">{brand.royalty} royalty</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => openEdit(brand)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-semibold rounded-lg transition-all border border-blue-600/30"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => handleDelete(brand.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-semibold rounded-lg transition-all border border-red-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No brands found.</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Brand' : 'Add Brand'}</h3>
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
                  <label className="block text-xs text-slate-500 mb-1">Brand Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="Brand Name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Slug *</label>
                  <input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    placeholder="brand-slug"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="franchise">Franchise</option>
                    <option value="consulting">Consulting</option>
                    <option value="visa">Visa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Sector</label>
                  <input
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="e.g. Education, F&B, Retail"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white resize-none"
                  placeholder="Brand description..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Investment Range</label>
                  <input
                    value={form.investment_range}
                    onChange={(e) => setForm({ ...form, investment_range: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="e.g. 10L - 50L"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Royalty</label>
                  <input
                    value={form.royalty}
                    onChange={(e) => setForm({ ...form, royalty: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="e.g. 8%"
                  />
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
                  {saving ? 'Saving...' : editingId ? 'Update Brand' : 'Create Brand'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
