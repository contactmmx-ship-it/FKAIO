import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  GitBranch,
  Plus,
  XCircle,
  Play,
  Pause,
  Edit2,
  Trash2,
  Zap,
  Clock,
  CheckCircle,
  ArrowRight,
  Filter,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  dept: string;
};

type Workflow = {
  id: string;
  agent_id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: Record<string, unknown>[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  success_count: number;
  created_at: string;
  agent?: Agent;
};

const triggerColors: Record<string, string> = {
  manual: 'bg-slate-500/20 text-slate-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  event: 'bg-amber-500/20 text-amber-400',
  webhook: 'bg-violet-500/20 text-violet-400',
  lead_created: 'bg-emerald-500/20 text-emerald-400',
  stage_changed: 'bg-cyan-500/20 text-cyan-400',
};

const emptyForm = {
  agent_id: '',
  name: '',
  trigger_type: 'manual',
  steps: [] as { type: string; config: Record<string, unknown> }[],
};

const stepTypes = [
  { value: 'trigger', label: 'Trigger', icon: Zap, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'condition', label: 'Condition', icon: Filter, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'action', label: 'Action', icon: Play, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'delay', label: 'Delay', icon: Clock, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  { value: 'notification', label: 'Notification', icon: CheckCircle, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
];

export default function WorkflowManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [filterAgent, setFilterAgent] = useState('ALL');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // filtering is done inline in filteredWorkflows
  }, [workflows, filterAgent]);

  async function loadData() {
    setLoading(true);
    const { data: agentsData } = await supabase.from('ai_agents').select('id, name, dept').order('name');
    const { data: workflowsData } = await supabase
      .from('agent_workflows')
      .select('*, agent:ai_agents(id, name, dept)')
      .order('created_at', { ascending: false });
    setAgents(agentsData || []);
    setWorkflows(workflowsData || []);
    setLoading(false);
  }

  async function toggleActive(w: Workflow) {
    await supabase.from('agent_workflows').update({ is_active: !w.is_active }).eq('id', w.id);
    loadData();
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(w: Workflow) {
    setEditingId(w.id);
    setForm({
      agent_id: w.agent_id,
      name: w.name,
      trigger_type: w.trigger_type,
      steps: (w.steps as { type: string; config: Record<string, unknown> }[]) || [],
    });
    setShowModal(true);
  }

  function addStep() {
    setForm({
      ...form,
      steps: [...form.steps, { type: 'action', config: { description: '' } }],
    });
  }

  function updateStep(index: number, field: string, value: string) {
    const newSteps = [...form.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setForm({ ...form, steps: newSteps });
  }

  function updateStepConfig(index: number, key: string, value: string) {
    const newSteps = [...form.steps];
    newSteps[index] = { ...newSteps[index], config: { ...newSteps[index].config, [key]: value } };
    setForm({ ...form, steps: newSteps });
  }

  function removeStep(index: number) {
    setForm({ ...form, steps: form.steps.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    if (!form.name || !form.agent_id) {
      setMessage('Name and agent are required.');
      setSaving(false);
      return;
    }
    const payload = {
      agent_id: form.agent_id,
      name: form.name,
      trigger_type: form.trigger_type,
      steps: form.steps,
    };
    if (editingId) {
      await supabase.from('agent_workflows').update(payload).eq('id', editingId);
      setMessage('Workflow updated successfully');
    } else {
      await supabase.from('agent_workflows').insert([payload]);
      setMessage('Workflow created successfully');
    }
    setTimeout(() => {
      setMessage('');
      setShowModal(false);
    }, 1500);
    setSaving(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workflow? This cannot be undone.')) return;
    await supabase.from('agent_workflows').delete().eq('id', id);
    loadData();
  }

  async function runWorkflow(w: Workflow) {
    await supabase
      .from('agent_workflows')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: w.run_count + 1,
        success_count: w.success_count + 1,
      })
      .eq('id', w.id);
    loadData();
  }

  const filteredWorkflows = (() => {
    let result = workflows;
    if (filterAgent !== 'ALL') {
      result = result.filter((w) => w.agent_id === filterAgent);
    }
    return result;
  })();

  const activeCount = workflows.filter((w) => w.is_active).length;
  const totalRuns = workflows.reduce((sum, w) => sum + w.run_count, 0);
  const totalSuccess = workflows.reduce((sum, w) => sum + w.success_count, 0);

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
          <GitBranch className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold">Workflow Manager</h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30"
        >
          <Plus className="w-4 h-4" /> Create Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{workflows.length}</p>
          <p className="text-xs text-slate-500">Total Workflows</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-cyan-400">{totalRuns}</p>
          <p className="text-xs text-slate-500">Total Runs</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-400">{totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0}%</p>
          <p className="text-xs text-slate-500">Success Rate</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-400">Filter by Agent:</span>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex-wrap">
          <button
            onClick={() => setFilterAgent('ALL')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filterAgent === 'ALL' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setFilterAgent(a.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterAgent === a.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.map((wf) => (
          <div
            key={wf.id}
            className={`bg-slate-900 border rounded-2xl p-5 hover:border-slate-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all ${
              selectedWorkflow?.id === wf.id ? 'border-blue-600/50 ring-1 ring-blue-600/20' : 'border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{wf.name}</p>
                  <p className="text-xs text-slate-500">{wf.agent?.name || 'Unknown Agent'}</p>
                </div>
              </div>
              <button onClick={() => toggleActive(wf)}>
                {wf.is_active ? (
                  <Pause className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Play className="w-5 h-5 text-slate-500" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${triggerColors[wf.trigger_type] || 'bg-slate-500/20 text-slate-400'}`}>
                {wf.trigger_type}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${wf.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-500'}`}>
                {wf.is_active ? 'Active' : 'Paused'}
              </span>
            </div>

            {/* Steps Preview */}
            <div className="flex items-center gap-1 mb-3 flex-wrap">
              {(wf.steps || []).slice(0, 4).map((step: any, i: number) => {
                const st = stepTypes.find((s) => s.value === step.type);
                return (
                  <div key={i} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st?.color || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                      {st?.label || step.type}
                    </span>
                  </div>
                );
              })}
              {(wf.steps || []).length > 4 && (
                <span className="text-[10px] text-slate-500">+{(wf.steps as unknown[]).length - 4} more</span>
              )}
              {(wf.steps || []).length === 0 && (
                <span className="text-xs text-slate-600">No steps defined</span>
              )}
            </div>

            {/* Run Stats */}
            <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
              <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {wf.run_count} runs</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {wf.success_count} success</span>
              {wf.last_run_at && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(wf.last_run_at).toLocaleDateString('en-IN')}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedWorkflow(selectedWorkflow?.id === wf.id ? null : wf)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"
              >
                <ChevronRight className="w-3 h-3" /> Details
              </button>
              <button
                onClick={() => runWorkflow(wf)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-semibold rounded-lg transition-all border border-blue-600/30"
              >
                <Play className="w-3 h-3" /> Run
              </button>
              <button
                onClick={() => openEdit(wf)}
                className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-all border border-blue-600/30"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(wf.id)}
                className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-all border border-red-600/30"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredWorkflows.length === 0 && (
        <div className="text-center py-12">
          <GitBranch className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No workflows found. Create your first workflow.</p>
        </div>
      )}

      {/* Selected Workflow Detail */}
      {selectedWorkflow && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">{selectedWorkflow.name}</h3>
              <p className="text-sm text-slate-500">{selectedWorkflow.agent?.name || 'Unknown'}</p>
            </div>
            <button onClick={() => setSelectedWorkflow(null)} className="text-slate-500 hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Pipeline */}
          <div className="space-y-0">
            {(selectedWorkflow.steps || []).map((step: any, i: number) => {
              const st = stepTypes.find((s) => s.value === step.type);
              const Icon = st?.icon || Zap;
              return (
                <div key={i}>
                  <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-800/50 transition-colors">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${st?.color || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {i < (selectedWorkflow.steps as unknown[]).length - 1 && (
                        <div className="w-0.5 h-8 bg-slate-700 mt-1" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold capitalize">{st?.label || step.type}</p>
                      {step.config && Object.keys(step.config).length > 0 && (
                        <div className="mt-2 bg-slate-800/50 rounded-lg p-3">
                          {Object.entries(step.config).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2 text-xs mb-1 last:mb-0">
                              <span className="text-slate-500 font-mono">{key}:</span>
                              <span className="text-slate-300">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 font-mono">Step {i + 1}</span>
                  </div>
                </div>
              );
            })}
            {(selectedWorkflow.steps || []).length === 0 && (
              <p className="text-center text-slate-500 py-8">No steps defined in this workflow.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Workflow' : 'Create Workflow'}</h3>
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
                  <label className="block text-xs text-slate-500 mb-1">Workflow Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="My Workflow"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Agent *</label>
                  <select
                    value={form.agent_id}
                    onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select Agent</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.dept})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Trigger Type</label>
                <select
                  value={form.trigger_type}
                  onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="manual">Manual</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="event">Event</option>
                  <option value="webhook">Webhook</option>
                  <option value="lead_created">Lead Created</option>
                  <option value="stage_changed">Stage Changed</option>
                </select>
              </div>

              {/* Steps Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs text-slate-500">Steps</label>
                  <button
                    onClick={addStep}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-semibold rounded-lg transition-all border border-blue-600/30"
                  >
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {form.steps.map((step, i) => {
                    const st = stepTypes.find((s) => s.value === step.type);
                    const Icon = st?.icon || Zap;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${st?.color || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Step {i + 1}</span>
                            <select
                              value={step.type}
                              onChange={(e) => updateStep(i, 'type', e.target.value)}
                              className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                            >
                              {stepTypes.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            value={(step.config.description as string) || ''}
                            onChange={(e) => updateStepConfig(i, 'description', e.target.value)}
                            placeholder="Step description..."
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white"
                          />
                        </div>
                        <button
                          onClick={() => removeStep(i)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
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
                  {saving ? 'Saving...' : editingId ? 'Update Workflow' : 'Create Workflow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
