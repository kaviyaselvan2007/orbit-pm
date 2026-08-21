// src/pages/Projects.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { attachRisk } from '../utils/riskEngine';
import Modal from '../components/Modal';
import { Pill, riskTone, statusTone, priorityTone, toast } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { Pencil, Trash2, Plus, Eye, CheckCircle2, Check } from 'lucide-react';
import { filterProjects } from '../utils/authFilters';

const EMPTY = { name: '', client_id: '', start_date: '', end_date: '', progress: 0, priority: 'Medium', status: 'Active', assigned_employees: '', remarks: '' };

export default function Projects() {
  const { user } = useAuth();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [q, setQ] = useState(location.state?.q || '');

  useEffect(() => {
    if (location.state?.q !== undefined) {
      setQ(location.state.q);
    }
  }, [location.state]);
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingProject, setViewingProject] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const isAdminOrPM = user?.role === 'Admin' || user?.role === 'Project Manager';
  const isEmployee = user?.role === 'Employee';

  const load = async () => {
    const [{ data: projectRows }, { data: employeeRows }, { data: clientRows }] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('id'),
      supabase.from('employees').select('*, profiles(role)'),
      supabase.from('clients').select('*').order('name'),
    ]);
    const normalized = (projectRows || []).map(p => ({ ...p, client_name: p.clients?.name || '' }));
    const visibleProjects = filterProjects(normalized, employeeRows || [], user);
    setProjects(attachRisk(visibleProjects, employeeRows || []));
    setClients(clientRows || []);
    setEmployees(employeeRows || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => projects.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.project_code || '').toLowerCase().includes(q.toLowerCase()) || (p.client_name || '').toLowerCase().includes(q.toLowerCase());
    return matchQ && (!statusFilter || p.status === statusFilter) && (!priorityFilter || p.priority === priorityFilter);
  }), [projects, q, statusFilter, priorityFilter]);

  const openNew = () => {
    setForm(EMPTY); setEditingId(null); setModalOpen(true);
  };
  const openEdit = (p) => {
    setForm({ name: p.name, client_id: p.client_id || '', start_date: p.start_date || '', end_date: p.end_date || '', progress: p.progress, priority: p.priority, status: p.status, assigned_employees: p.assigned_employees || '', remarks: p.remarks || '' });
    setEditingId(p.id); setModalOpen(true);
  };
  const openView = (p) => {
    setViewingProject(p);
    setViewModalOpen(true);
  };

  const completeProject = async (p) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'Completed', progress: 100 })
        .eq('id', p.id);
      if (error) throw error;
      toast(`Project "${p.name}" marked as Completed!`);
      load();
    } catch (err) {
      toast(err.message || 'Unable to update project status.');
    }
  };

  const syncEmployeesForProject = async (projCode, selectedNames) => {
    const { data: allEmps } = await supabase.from('employees').select('id, name, assigned_projects');
    if (!allEmps) return;
    
    for (const emp of allEmps) {
      const assignedList = emp.assigned_projects
        ? emp.assigned_projects.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const isAssigned = selectedNames.includes(emp.name);
      
      let newList = [...assignedList];
      if (isAssigned) {
        if (!newList.includes(projCode)) {
          newList.push(projCode);
        }
      } else {
        newList = newList.filter(code => code !== projCode);
      }
      
      const newAssignedProjects = newList.join(', ');
      if (newAssignedProjects !== (emp.assigned_projects || '')) {
        await supabase
          .from('employees')
          .update({ assigned_projects: newAssignedProjects })
          .eq('id', emp.id);
      }
    }
  };

  const save = async () => {
    if (!isAdminOrPM) {
      toast("Access Denied: Only Admins and Project Managers can create or edit projects.");
      return;
    }
    try {
      const payload = { ...form, client_id: form.client_id || null };
      let finalProjectCode = '';

      if (editingId) {
        const { error } = await supabase.from('projects').update(payload).eq('id', editingId);
        if (error) throw error;
        const proj = projects.find(p => p.id === editingId);
        if (proj) finalProjectCode = proj.project_code;
      } else {
        const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        const project_code = 'PRJ-' + String((count || 0) + 1).padStart(3, '0');
        finalProjectCode = project_code;
        const { error } = await supabase.from('projects').insert({ ...payload, project_code });
        if (error) throw error;
      }

      if (finalProjectCode) {
        const selectedNames = form.assigned_employees
          ? form.assigned_employees.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        await syncEmployeesForProject(finalProjectCode, selectedNames);
      }

      setModalOpen(false); load(); toast('Project saved successfully.');
    } catch (err) { toast(err.message || 'Unable to save project.'); }
  };

  const remove = async (id) => {
    if (!isAdminOrPM) {
      toast("Access Denied: Only Admins and Project Managers can delete projects.");
      return;
    }
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { toast(error.message); return; }
    load(); toast('Project deleted.');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2.5 items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2.5">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects, code or client…" className="px-3 py-2 rounded-lg text-[13px] border border-slate-200 min-w-[220px]" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-2 rounded-lg text-[13px] border border-slate-200">
            <option value="">All Status</option><option>Active</option><option>Completed</option><option>Delayed</option><option>On Hold</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-2.5 py-2 rounded-lg text-[13px] border border-slate-200">
            <option value="">All Priority</option><option>Low</option><option>Medium</option><option>High</option>
          </select>
        </div>
        {isAdminOrPM && (
          <button onClick={openNew} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-light">
            <Plus size={15} strokeWidth={2} /> Add Project
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-[10px] shadow-sm overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-[11.5px] uppercase text-slate-500 border-b border-slate-200">
              {['Code', 'Project', 'Client', 'Employees', 'Timeline', 'Progress', 'Priority', 'Status', 'Risk', 'Actions'].map(h => <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-slate-100 last:border-none">
                <td className="px-3 py-2.5 font-mono-plex whitespace-nowrap">{p.project_code}</td>
                <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{p.name}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{p.client_name}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 max-w-[150px] truncate" title={p.assigned_employees}>{p.assigned_employees || '—'}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{p.start_date} → {p.end_date}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[70px] h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-teal" style={{ width: `${p.progress}%` }} /></div>
                    <span className="text-[12px]">{p.progress}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5"><Pill tone={priorityTone(p.priority)}>{p.priority}</Pill></td>
                <td className="px-3 py-2.5"><Pill tone={statusTone(p.status)}>{p.status}</Pill></td>
                <td className="px-3 py-2.5"><Pill tone={riskTone(p.risk?.level)}>{p.risk?.level}</Pill></td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {isAdminOrPM && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} title="Edit Project" className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-500"><Pencil size={14} strokeWidth={1.9} /></button>
                      <button onClick={() => remove(p.id)} title="Delete Project" className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-500"><Trash2 size={14} strokeWidth={1.9} /></button>
                    </div>
                  )}
                  {isEmployee && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openView(p)} title="View Project Details" className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600 flex items-center gap-1 text-[12px] font-medium border border-slate-200">
                        <Eye size={13} /> View
                      </button>
                      {p.status !== 'Completed' ? (
                        <button onClick={() => completeProject(p)} title="Mark as Completed" className="px-2.5 py-1 rounded bg-teal hover:bg-teal-light text-white text-[12px] font-semibold flex items-center gap-1 transition shadow-sm">
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      ) : (
                        <span className="text-emerald-600 text-[12px] font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Check size={13} strokeWidth={2.5} /> Done
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={10} className="text-center text-slate-400 py-10">No projects found matching the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* View Only Modal for Employee */}
      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Project Overview" subtitle="View deliverable and timeline details."
        footer={<button onClick={() => setViewModalOpen(false)} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Close</button>}>
        {viewingProject && (
          <div className="space-y-3.5 text-[13.5px]">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Project Code</span>
                <span className="font-mono-plex font-bold text-slate-800">{viewingProject.project_code}</span>
              </div>
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Status</span>
                <Pill tone={statusTone(viewingProject.status)}>{viewingProject.status}</Pill>
              </div>
            </div>

            <div>
              <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Project Name</span>
              <div className="font-semibold text-slate-800 text-[15px]">{viewingProject.name}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Client</span>
                <span className="text-slate-700">{viewingProject.client_name || '—'}</span>
              </div>
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Priority</span>
                <Pill tone={priorityTone(viewingProject.priority)}>{viewingProject.priority}</Pill>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Timeline</span>
                <span className="text-slate-700">{viewingProject.start_date} → {viewingProject.end_date}</span>
              </div>
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Progress</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-teal" style={{ width: `${viewingProject.progress}%` }} /></div>
                  <span className="font-mono-plex font-bold text-xs">{viewingProject.progress}%</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Assigned Team</span>
              <div className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{viewingProject.assigned_employees || 'No employees assigned.'}</div>
            </div>

            {viewingProject.remarks && (
              <div>
                <span className="text-[11.5px] text-slate-500 uppercase font-semibold block mb-0.5">Project Outcome & Scope</span>
                <div className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">{viewingProject.remarks}</div>
              </div>
            )}

            {isEmployee && viewingProject.status !== 'Completed' && (
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    completeProject(viewingProject);
                    setViewModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal hover:bg-teal-light text-white text-sm font-semibold"
                >
                  <CheckCircle2 size={15} /> Mark This Project as Completed
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${editingId ? 'Edit' : 'New'} Project`} subtitle="Fill in the project details below."
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Save Project</button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <F label="Project Name" full><input className="in" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Client">
            <select className="in" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
              <option value="">— Select —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </F>
          <F label="Priority">
            <select className="in" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select>
          </F>
          <F label="Start Date"><input type="date" className="in" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></F>
          <F label="End Date"><input type="date" className="in" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></F>
          <F label="Progress %"><input type="number" className="in" value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })} /></F>
          <F label="Status">
            <select className="in" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Completed</option><option>Delayed</option><option>On Hold</option></select>
          </F>
          <F label="Assign Employees" full>
            <div className="border border-slate-200 rounded-lg p-3 max-h-[140px] overflow-y-auto bg-slate-50/50 grid grid-cols-2 gap-2 mt-1">
              {employees.map(emp => {
                const assignedList = form.assigned_employees
                  ? form.assigned_employees.split(',').map(s => s.trim()).filter(Boolean)
                  : [];
                const isChecked = assignedList.includes(emp.name);
                const handleToggle = (checked) => {
                  let newList;
                  if (checked) {
                    newList = [...assignedList, emp.name];
                  } else {
                    newList = assignedList.filter(name => name !== emp.name);
                  }
                  setForm({ ...form, assigned_employees: newList.join(', ') });
                };
                return (
                  <label key={emp.id} className="flex items-center gap-2 text-[12.5px] cursor-pointer hover:bg-slate-100/80 p-1 rounded transition-all">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => handleToggle(e.target.checked)}
                      className="rounded text-teal focus:ring-teal border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="font-medium text-slate-700">{emp.name}</span>
                  </label>
                );
              })}
              {!employees.length && <div className="text-slate-400 text-xs col-span-2">No employees available.</div>}
            </div>
          </F>
          <F label="Project Outcome" full><textarea className="in" rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} /></F>
        </div>
      </Modal>
      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}

function F({ label, children, full }) {
  return <div className={full ? 'col-span-2' : ''}><label className="block text-[12px] text-slate-500 mb-1 font-medium">{label}</label>{children}</div>;
}
