// src/pages/Outcomes.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Edit3, CheckCircle2, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { filterProjects } from '../utils/authFilters';
import { Pill, statusTone, toast } from '../components/UI';
import Modal from '../components/Modal';

export default function Outcomes() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [remarksForm, setRemarksForm] = useState('');
  const [statusForm, setStatusForm] = useState('Active');
  const [progressForm, setProgressForm] = useState(0);

  const load = async () => {
    const [{ data: projectRows }, { data: employeeRows }] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('id'),
      supabase.from('employees').select('*, profiles(role)'),
    ]);

    const normalized = (projectRows || []).map(p => ({
      ...p,
      client_name: p.clients?.name || ''
    }));
    setProjects(filterProjects(normalized, employeeRows || [], user));
  };

  useEffect(() => {
    load();
  }, [user]);

  const filtered = useMemo(() => projects.filter(p => {
    const matchQ = !q || 
      p.name.toLowerCase().includes(q.toLowerCase()) || 
      (p.project_code || '').toLowerCase().includes(q.toLowerCase()) || 
      (p.client_name || '').toLowerCase().includes(q.toLowerCase());
    return matchQ && (!statusFilter || p.status === statusFilter);
  }), [projects, q, statusFilter]);

  const openUpdate = (p) => {
    setEditingProject(p);
    setRemarksForm(p.remarks || '');
    setStatusForm(p.status || 'Active');
    setProgressForm(p.progress || 0);
    setEditModalOpen(true);
  };

  const handleSaveOutcome = async () => {
    if (!editingProject) return;
    try {
      const updates = {
        remarks: remarksForm,
        status: statusForm,
        progress: statusForm === 'Completed' ? 100 : Number(progressForm)
      };

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', editingProject.id);

      if (error) throw error;
      toast('Project outcome updated successfully.');
      setEditModalOpen(false);
      load();
    } catch (err) {
      toast(err.message || 'Unable to update outcome.');
    }
  };

  const handleQuickComplete = async (p) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'Completed', progress: 100 })
        .eq('id', p.id);
      if (error) throw error;
      toast(`Project "${p.name}" marked as Completed!`);
      load();
    } catch (err) {
      toast(err.message || 'Unable to complete task.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <div className="font-semibold text-[15px] flex items-center gap-2">
          <ClipboardList size={16} strokeWidth={2} className="text-teal" /> Project Outcomes & Task Deliverables
        </div>
        <div className="text-[12.5px] text-slate-500 max-w-2xl mt-0.5">
          View and record outcomes, progress, and deliverable notes for your assigned projects.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm w-full">
        <div className="flex flex-wrap gap-2.5 items-center justify-between mb-4">
          <div className="flex flex-wrap gap-2.5">
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search project code, name or client…" 
              className="px-3 py-2 rounded-lg text-[13px] border border-slate-200 min-w-[260px]" 
            />
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)} 
              className="px-2.5 py-2 rounded-lg text-[13px] border border-slate-200" 
            >
              <option value="">All Status</option>
              <option>Active</option>
              <option>Completed</option>
              <option>Delayed</option>
              <option>On Hold</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-[11.5px] uppercase text-slate-500 border-b border-slate-200 bg-slate-50/70">
                <th className="text-left px-4 py-3 whitespace-nowrap">Code</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Project</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Client</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Timeline</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Progress</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-3 whitespace-nowrap min-w-[240px]">Project Outcome & Deliverable</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono-plex whitespace-nowrap font-semibold">{p.project_code || '—'}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{p.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{p.client_name || '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                    {p.start_date && p.end_date ? `${p.start_date} → ${p.end_date}` : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-[60px] h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full bg-teal" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-[12px] font-mono-plex">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                  </td>
                  <td className="px-4 py-3 leading-relaxed text-[13px] text-slate-700 whitespace-pre-wrap max-w-sm">
                    {p.remarks ? (
                      p.remarks
                    ) : (
                      <span className="text-slate-400 italic">No outcome notes recorded yet.</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openUpdate(p)} 
                        title="Update Task Outcome"
                        className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 text-[12px] font-medium flex items-center gap-1 transition"
                      >
                        <Edit3 size={13} /> Update
                      </button>
                      {p.status !== 'Completed' ? (
                        <button
                          onClick={() => handleQuickComplete(p)}
                          title="Mark as Completed"
                          className="px-2.5 py-1 rounded bg-teal hover:bg-teal-light text-white text-[12px] font-semibold flex items-center gap-1 transition shadow-sm"
                        >
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      ) : (
                        <span className="text-emerald-600 text-[12px] font-semibold flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Check size={12} strokeWidth={2.5} /> Done
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    No project outcomes found matching your assigned projects and search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outcome / Task Update Modal */}
      <Modal 
        open={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        title={`Update Task Outcome: ${editingProject?.name || ''}`}
        subtitle="Record deliverable notes, update completion progress and status."
        footer={
          <>
            <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
            <button onClick={handleSaveOutcome} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-light">Save Outcome</button>
          </>
        }
      >
        {editingProject && (
          <div className="space-y-3.5 text-[13px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-slate-500 mb-1 font-medium">Deliverable Status</label>
                <select 
                  className="in" 
                  value={statusForm} 
                  onChange={e => {
                    setStatusForm(e.target.value);
                    if (e.target.value === 'Completed') setProgressForm(100);
                  }}
                >
                  <option>Active</option>
                  <option>Completed</option>
                  <option>Delayed</option>
                  <option>On Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-slate-500 mb-1 font-medium">Progress (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  className="in font-mono-plex" 
                  value={progressForm} 
                  onChange={e => setProgressForm(Number(e.target.value))} 
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] text-slate-500 mb-1 font-medium">Project Outcome & Deliverable Notes</label>
              <textarea 
                className="in" 
                rows={4} 
                placeholder="Describe outcome status, completed modules, or blockers..."
                value={remarksForm} 
                onChange={e => setRemarksForm(e.target.value)} 
              />
            </div>
          </div>
        )}
      </Modal>

      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}