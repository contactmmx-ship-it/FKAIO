import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Upload, Zap, Filter, ChevronLeft, ChevronRight, Loader2,
  FileText, Building2, Calendar, Tag, BarChart3,
  CreditCard, Banknote, XCircle
} from 'lucide-react';

// ── Local Types ──────────────────────────────────────────────

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string | null;
  brand_id: string | null;
  status: string;
  reference: string | null;
  created_at: string;
  brand?: { id: string; name: string } | null;
};

type BankStatement = {
  id: string;
  bank_name: string;
  account_last_four: string;
  statement_date: string;
  period_start: string;
  period_end: string;
  status: string;
  transaction_count: number | null;
  total_credits: number | null;
  total_debits: number | null;
  created_at: string;
};

type RevenueSnapshot = {
  id: string;
  month: string;
  brand_id: string | null;
  brand_name: string | null;
  total_revenue: number;
  invoice_count: number | null;
  collection_rate: number | null;
  created_at: string;
};

type FinancialAccount = {
  id: string;
  account_name: string;
  account_type: string;
  bank_name: string | null;
  account_number_last_four: string | null;
  current_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
};

type Tab = 'transactions' | 'statements' | 'revenue' | 'accounts';

const PAGE_SIZE = 15;

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  // Summary
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    unreconciled: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  // Bank Statements
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [stmtLoading, setStmtLoading] = useState(true);
  const [stmtError, setStmtError] = useState<string | null>(null);

  // Revenue Snapshots
  const [snapshots, setSnapshots] = useState<RevenueSnapshot[]>([]);
  const [revLoading, setRevLoading] = useState(true);
  const [revError, setRevError] = useState<string | null>(null);

  // Accounts
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accLoading, setAccLoading] = useState(true);
  const [accError, setAccError] = useState<string | null>(null);

  // Brands (for filter)
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [filterBrand, setFilterBrand] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Auto-classify
  const [classifying, setClassifying] = useState(false);

  // Upload statement modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
    loadTransactions();
    loadStatements();
    loadRevenue();
    loadAccounts();
    loadBrands();
  }, [txPage, filterBrand, filterDateFrom, filterDateTo, filterCategory]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const { data: credits } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'credit');

      const { data: debits } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'debit');

      const { count: unreconciledCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unreconciled');

      const totalCredits = (credits || []).reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalDebits = (debits || []).reduce((sum, t) => sum + (t.amount || 0), 0);

      setSummary({
        totalRevenue: totalCredits,
        totalExpenses: totalDebits,
        netProfit: totalCredits - totalDebits,
        unreconciled: unreconciledCount || 0,
      });
    } catch (err: any) {
      console.error('[Accounting] Error loading summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      let query = supabase
        .from('transactions')
        .select('*, brand:brands(id, name)')
        .order('date', { ascending: false })
        .range((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE - 1);

      if (filterBrand) query = query.eq('brand_id', filterBrand);
      if (filterCategory) query = query.eq('category', filterCategory);
      if (filterDateFrom) query = query.gte('date', filterDateFrom);
      if (filterDateTo) query = query.lte('date', filterDateTo);

      const { data, error, count } = await query;
      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
      setTxTotal(count || 0);
    } catch (err: any) {
      console.error('[Accounting] Error loading transactions:', err);
      setTxError(err.message || 'Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  }, [txPage, filterBrand, filterDateFrom, filterDateTo, filterCategory]);

  const loadStatements = useCallback(async () => {
    setStmtLoading(true);
    setStmtError(null);
    try {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .order('statement_date', { ascending: false });

      if (error) throw error;
      setStatements((data as BankStatement[]) || []);
    } catch (err: any) {
      console.error('[Accounting] Error loading statements:', err);
      setStmtError(err.message || 'Failed to load statements');
    } finally {
      setStmtLoading(false);
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    setRevLoading(true);
    setRevError(null);
    try {
      const { data, error } = await supabase
        .from('revenue_snapshots')
        .select('*')
        .order('month', { ascending: false })
        .limit(12);

      if (error) throw error;
      setSnapshots((data as RevenueSnapshot[]) || []);
    } catch (err: any) {
      console.error('[Accounting] Error loading revenue:', err);
      setRevError(err.message || 'Failed to load revenue snapshots');
    } finally {
      setRevLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setAccLoading(true);
    setAccError(null);
    try {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_name');

      if (error) throw error;
      setAccounts((data as FinancialAccount[]) || []);
    } catch (err: any) {
      console.error('[Accounting] Error loading accounts:', err);
      setAccError(err.message || 'Failed to load accounts');
    } finally {
      setAccLoading(false);
    }
  }, []);

  const loadBrands = useCallback(async () => {
    const { data } = await supabase.from('brands').select('id, name').eq('is_active', true).order('name');
    setBrands(data || []);
  }, []);

  // Auto-classify
  async function handleAutoClassify() {
    setClassifying(true);
    try {
      const { error } = await supabase.rpc('auto_classify_transactions');
      if (error) throw error;
      loadTransactions();
      loadSummary();
    } catch (err: any) {
      console.error('[Accounting] Auto-classify error:', err);
      alert('Auto-classify failed: ' + (err.message || 'Unknown error'));
    } finally {
      setClassifying(false);
    }
  }

  // Upload statement
  async function handleUploadStatement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setUploading(true);
    setUploadError(null);
    try {
      const file = formData.get('file') as File;
      let filePath: string | null = null;
      if (file && file.size > 0) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        filePath = `bank-statements/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
        if (uploadErr) throw uploadErr;
      }
      const { error: insertErr } = await supabase.from('bank_statements').insert([{
        bank_name: formData.get('bank_name'),
        account_last_four: formData.get('account_last_four'),
        statement_date: formData.get('statement_date') || null,
        period_start: formData.get('period_start') || null,
        period_end: formData.get('period_end') || null,
        status: 'importing',
        file_path: filePath,
      }]);
      if (insertErr) throw insertErr;
      setShowUpload(false);
      loadStatements();
    } catch (err: any) {
      console.error('[Accounting] Upload error:', err);
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const clearFilters = () => {
    setFilterBrand('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterCategory('');
    setTxPage(1);
  };

  const totalPages = Math.ceil(txTotal / PAGE_SIZE);

  function formatCurrency(amount: number): string {
    return '₹' + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'transactions', label: 'Transactions', icon: CreditCard },
    { key: 'statements', label: 'Bank Statements', icon: Banknote },
    { key: 'revenue', label: 'Revenue Snapshots', icon: BarChart3 },
    { key: 'accounts', label: 'Accounts', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Revenue</p>
              {summaryLoading ? (
                <div className="flex items-center gap-1 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
              ) : (
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(summary.totalRevenue)}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Expenses</p>
              {summaryLoading ? (
                <div className="flex items-center gap-1 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
              ) : (
                <p className="text-xl font-bold text-red-400">{formatCurrency(summary.totalExpenses)}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Net Profit</p>
              {summaryLoading ? (
                <div className="flex items-center gap-1 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
              ) : (
                <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {summary.netProfit >= 0 ? '+' : '-'}{formatCurrency(summary.netProfit)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Unreconciled</p>
              {summaryLoading ? (
                <div className="flex items-center gap-1 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
              ) : (
                <p className="text-xl font-bold text-amber-400">{summary.unreconciled}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex-wrap">
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
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
          >
            <Upload className="w-4 h-4" /> Upload Statement
          </button>
          <button
            onClick={handleAutoClassify}
            disabled={classifying}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-sm font-semibold rounded-xl transition-all border border-amber-600/30 disabled:opacity-50"
          >
            {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Auto-Classify
          </button>
        </div>
      </div>

      {/* ── Transactions Tab ──────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium rounded-lg hover:text-white transition-all"
            >
              <Filter className="w-3 h-3" />
              Filters
              {(filterBrand || filterDateFrom || filterDateTo || filterCategory) && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>
            {(filterBrand || filterDateFrom || filterDateTo || filterCategory) && (
              <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-white">Clear all</button>
            )}
          </div>

          {showFilters && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Brand</label>
                <select
                  value={filterBrand}
                  onChange={(e) => { setFilterBrand(e.target.value); setTxPage(1); }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">All Brands</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setTxPage(1); }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setTxPage(1); }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setTxPage(1); }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">All Categories</option>
                  <option value="franchise_fee">Franchise Fee</option>
                  <option value="royalty">Royalty</option>
                  <option value="training">Training</option>
                  <option value="marketing">Marketing</option>
                  <option value="operations">Operations</option>
                  <option value="salary">Salary</option>
                  <option value="refund">Refund</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {txError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4" />
              {txError}
            </div>
          )}

          {txLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <CreditCard className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="text-left px-6 py-3 font-semibold">Date</th>
                        <th className="text-left px-6 py-3 font-semibold">Description</th>
                        <th className="text-right px-6 py-3 font-semibold">Amount</th>
                        <th className="text-left px-6 py-3 font-semibold">Type</th>
                        <th className="text-left px-6 py-3 font-semibold">Category</th>
                        <th className="text-left px-6 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-3 text-slate-400 text-xs">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="font-medium">{tx.description}</span>
                            {tx.brand?.name && (
                              <p className="text-xs text-slate-500 mt-0.5">{tx.brand.name}</p>
                            )}
                          </td>
                          <td className={`px-6 py-3 text-right font-semibold font-mono ${tx.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              tx.type === 'credit'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-400">
                            {tx.category ? (
                              <span className="flex items-center gap-1 text-xs">
                                <Tag className="w-3 h-3" />
                                {tx.category.replace(/_/g, ' ')}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">Unclassified</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              tx.status === 'reconciled'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}>
                              {tx.status === 'reconciled' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {tx.status === 'reconciled' ? 'Reconciled' : 'Unreconciled'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Showing {(txPage - 1) * PAGE_SIZE + 1}–{Math.min(txPage * PAGE_SIZE, txTotal)} of {txTotal}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txPage === 1}
                      className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - txPage) <= 1)
                      .reduce<(number | string)[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        typeof item === 'string' ? (
                          <span key={`dots-${idx}`} className="px-2 text-slate-600">...</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setTxPage(item)}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                              txPage === item
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))}
                      disabled={txPage === totalPages}
                      className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Bank Statements Tab ───────────────────────────── */}
      {activeTab === 'statements' && (
        <div className="space-y-4">
          {stmtError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4" />
              {stmtError}
            </div>
          )}
          {stmtLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : statements.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No bank statements found</p>
              <p className="text-slate-600 text-sm mt-1">Upload your first bank statement to begin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statements.map((stmt) => (
                <div key={stmt.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                        <Banknote className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{stmt.bank_name}</p>
                        <p className="text-xs text-slate-500">****{stmt.account_last_four}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      stmt.status === 'imported'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : stmt.status === 'importing'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {stmt.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div>
                      <p className="text-slate-500">Statement Date</p>
                      <p className="text-slate-300 mt-0.5">
                        {new Date(stmt.statement_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Transactions</p>
                      <p className="text-slate-300 mt-0.5 font-mono">{stmt.transaction_count ?? 0}</p>
                    </div>
                    {stmt.total_credits != null && (
                      <div>
                        <p className="text-slate-500">Credits</p>
                        <p className="text-emerald-400 mt-0.5 font-mono">{formatCurrency(stmt.total_credits)}</p>
                      </div>
                    )}
                    {stmt.total_debits != null && (
                      <div>
                        <p className="text-slate-500">Debits</p>
                        <p className="text-red-400 mt-0.5 font-mono">{formatCurrency(stmt.total_debits)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Revenue Snapshots Tab ──────────────────────────── */}
      {activeTab === 'revenue' && (
        <div className="space-y-4">
          {revError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4" />
              {revError}
            </div>
          )}
          {revLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No revenue snapshots available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {snapshots.map((snap) => (
                <div key={snap.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-lg font-bold text-white">{formatCurrency(snap.total_revenue)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(snap.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    {snap.brand_name && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {snap.brand_name}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-800 pt-3">
                    <div>
                      <p className="text-slate-500">Invoices</p>
                      <p className="text-slate-300 mt-0.5 font-mono">{snap.invoice_count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Collection Rate</p>
                      <p className="text-slate-300 mt-0.5 font-mono">{snap.collection_rate != null ? `${(snap.collection_rate * 100).toFixed(1)}%` : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Accounts Tab ──────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {accError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4" />
              {accError}
            </div>
          )}
          {accLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No financial accounts found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{acc.account_name}</p>
                        <p className="text-xs text-slate-500">{acc.account_type}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                      {acc.currency}
                    </span>
                  </div>
                  <div className="border-t border-slate-800 pt-3 mt-2">
                    <p className="text-xs text-slate-500">Current Balance</p>
                    <p className={`text-xl font-bold mt-0.5 ${acc.current_balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(acc.current_balance)}
                    </p>
                  </div>
                  {acc.bank_name && (
                    <p className="text-xs text-slate-500 mt-2">{acc.bank_name} · ****{acc.account_number_last_four}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Statement Modal ────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">Upload Bank Statement</h3>
              <button onClick={() => setShowUpload(false)} className="text-slate-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadStatement} className="p-6 space-y-4">
              {uploadError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4" />
                  {uploadError}
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bank Name</label>
                <input
                  name="bank_name"
                  type="text"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g., HDFC Bank"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Account Last 4 Digits</label>
                <input
                  name="account_last_four"
                  type="text"
                  maxLength={4}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="1234"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Period Start</label>
                  <input
                    name="period_start"
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Period End</label>
                  <input
                    name="period_end"
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Statement File (PDF/CSV)</label>
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.ofx"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}