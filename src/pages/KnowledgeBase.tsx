import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Upload, FileText, BookOpen, Database,
  ChevronDown, XCircle, Loader2, AlertCircle, FolderOpen,
  Clock, CheckCircle
} from 'lucide-react';

// ── Local Types ──────────────────────────────────────────────

type KnowledgeSource = {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  is_active: boolean;
  document_count?: number;
  created_at: string;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  source_id: string | null;
  file_type: string | null;
  status: string;
  chunk_count: number | null;
  file_size: number | null;
  created_at: string;
  source?: KnowledgeSource | null;
};

type SearchResult = {
  id: string;
  document_id: string;
  document_title: string;
  source_name: string;
  relevance_score: number;
  chunk_content: string;
  created_at: string;
};

type Tab = 'documents' | 'sources' | 'upload';

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState<Tab>('documents');

  // Documents state
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);

  // Sources state
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Upload state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    source_id: '',
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Load documents
  useEffect(() => {
    loadDocuments();
    loadSources();
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocLoading(true);
    setDocError(null);
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*, source:knowledge_sources(id, name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data as KnowledgeDocument[]) || []);
    } catch (err: any) {
      console.error('[KnowledgeBase] Error loading documents:', err);
      setDocError(err.message || 'Failed to load documents');
    } finally {
      setDocLoading(false);
    }
  }, []);

  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    setSourceError(null);
    try {
      const { data, error } = await supabase
        .from('knowledge_sources')
        .select('*')
        .order('name');

      if (error) throw error;
      setSources((data as KnowledgeSource[]) || []);
    } catch (err: any) {
      console.error('[KnowledgeBase] Error loading sources:', err);
      setSourceError(err.message || 'Failed to load sources');
    } finally {
      setSourceLoading(false);
    }
  }, []);

  // Search
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.rpc('search_knowledge', {
        query_text: searchQuery.trim(),
        match_threshold: 0.5,
        max_results: 20,
      });
      if (error) throw error;
      setSearchResults((data as SearchResult[]) || []);
    } catch (err: any) {
      console.error('[KnowledgeBase] Search error:', err);
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  // Upload
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.title.trim()) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      let filePath: string | null = null;
      if (uploadForm.file) {
        uploadForm.file.name.split('.').pop();
        const safeName = uploadForm.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        filePath = `knowledge/${Date.now()}_${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(filePath, uploadForm.file);

        if (uploadErr) throw uploadErr;
      }

      const { error: insertErr } = await supabase
        .from('knowledge_documents')
        .insert([{
          title: uploadForm.title.trim(),
          source_id: uploadForm.source_id || null,
          file_type: uploadForm.file ? uploadForm.file.type.split('/')[1]?.toUpperCase() || null : null,
          file_size: uploadForm.file ? uploadForm.file.size : null,
          status: 'processing',
          chunk_count: 0,
          file_path: filePath,
        }]);

      if (insertErr) throw insertErr;

      setUploadSuccess(true);
      setUploadForm({ title: '', source_id: '', file: null });
      loadDocuments();
    } catch (err: any) {
      console.error('[KnowledgeBase] Upload error:', err);
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // Tab definitions
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'sources', label: 'Sources', icon: Database },
    { key: 'upload', label: 'Upload', icon: Upload },
  ];

  const statusColors: Record<string, string> = {
    ready: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    processing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search knowledge base..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search Knowledge
          </button>
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="mt-4">
            {searchError && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                <AlertCircle className="w-4 h-4" />
                {searchError}
              </div>
            )}
            {searching && (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </div>
            )}
            {!searching && !searchError && searchResults.length === 0 && (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center">
                <Search className="w-4 h-4" />
                No results found for "{searchQuery}"
              </div>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{result.document_title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{result.source_name}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {(result.relevance_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{result.chunk_content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
          </button>
        ))}
      </div>

      {/* ── Documents Tab ─────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {docError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4" />
              {docError}
            </div>
          )}
          {docLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No documents found</p>
              <p className="text-slate-600 text-sm mt-1">Upload your first document to get started.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900 z-10">
                    <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-6 py-3 font-semibold">Title</th>
                      <th className="text-left px-6 py-3 font-semibold">Source</th>
                      <th className="text-left px-6 py-3 font-semibold">Type</th>
                      <th className="text-left px-6 py-3 font-semibold">Status</th>
                      <th className="text-left px-6 py-3 font-semibold">Chunks</th>
                      <th className="text-left px-6 py-3 font-semibold">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span className="font-medium">{doc.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-400">{doc.source?.name || '—'}</td>
                        <td className="px-6 py-3 text-slate-400">{doc.file_type || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColors[doc.status] || statusColors.pending}`}>
                            {doc.status === 'ready' && <CheckCircle className="w-3 h-3" />}
                            {doc.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {doc.status === 'failed' && <XCircle className="w-3 h-3" />}
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">{doc.chunk_count ?? 0}</td>
                        <td className="px-6 py-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sources Tab ───────────────────────────────────── */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          {sourceError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4" />
              {sourceError}
            </div>
          )}
          {sourceLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : sources.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No knowledge sources found</p>
              <p className="text-slate-600 text-sm mt-1">Create a source to organize your documents.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{source.name}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400">
                          {source.source_type}
                        </span>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full mt-2 ${source.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  </div>
                  {source.description && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{source.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BookOpen className="w-3 h-3" />
                    <span>{source.document_count ?? 0} documents</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Tab ────────────────────────────────────── */}
      {activeTab === 'upload' && (
        <div className="max-w-xl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Upload Document</h3>
                <p className="text-xs text-slate-500">Add documents to the knowledge base for AI retrieval</p>
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                <AlertCircle className="w-4 h-4" />
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4">
                <CheckCircle className="w-4 h-4" />
                Document uploaded successfully and queued for processing.
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Document Title</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  placeholder="e.g., Franchise Agreement Template"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Knowledge Source</label>
                <div className="relative">
                  <select
                    value={uploadForm.source_id}
                    onChange={(e) => setUploadForm({ ...uploadForm, source_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  >
                    <option value="">Select a source (optional)</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">File</label>
                <div className="relative">
                  <input
                    type="file"
                    onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 transition-all"
                    accept=".pdf,.txt,.md,.doc,.docx,.csv,.xlsx"
                  />
                </div>
                {uploadForm.file && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    {(uploadForm.file.size / 1024).toFixed(1)} KB — {uploadForm.file.name}
                  </p>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={uploading || !uploadForm.title.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}