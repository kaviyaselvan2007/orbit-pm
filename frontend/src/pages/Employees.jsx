// src/pages/Employees.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { supabase } from '../lib/supabaseClient';
import Modal from '../components/Modal';
import { Pill, riskTone, toast } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { filterEmployees } from '../utils/authFilters';
import { buildNameTooltipOptions } from '../utils/chartTooltips';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const EMPTY = { name: '', email: '', phone: '', department: '', designation: '', assigned_projects: '', daily_hours: 0, weekly_hours: 0, productivity_score: 0, workload: 'Low' };

export default function Employees() {
  const { user } = useAuth();
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState(location.state?.q || '');

  useEffect(() => {
    if (location.state?.q !== undefined) {
      setQ(location.state.q);
    }
  }, [location.state]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const canAdd = user?.role === 'Admin';
  const canEdit = user?.role === 'Admin' || user?.role === 'Project Manager';
  const canDelete = user?.role === 'Admin';

  const load = () => {
    supabase.from('employees').select('*, profiles(role)').order('id').then(({ data }) => {
      setRows(filterEmployees(data || [], user));
    });
    supabase.from('projects').select('id, name, project_code').order('project_code').then(({ data }) => {
      setProjects(data || []);
    });
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()) || (e.department || '').toLowerCase().includes(q.toLowerCase())), [rows, q]);

  const empWorkloadCounts = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0, Overloaded: 0 };
    rows.forEach(e => {
      const w = e.workload || 'Low';
      counts[w] = (counts[w] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const empChartData = useMemo(() => ({
    labels: ['Low', 'Medium', 'High', 'Overloaded'],
    datasets: [{
      data: [empWorkloadCounts.Low, empWorkloadCounts.Medium, empWorkloadCounts.High, empWorkloadCounts.Overloaded],
      backgroundColor: ['#2E9E5B', '#E2A33D', '#D5514C', '#952A25'],
      borderRadius: 6
    }]
  }), [empWorkloadCounts]);

  const empChartOptions = useMemo(() => buildNameTooltipOptions((category) => {
    return rows
      .filter(e => (e.workload || 'Low') === category)
      .map(e => `${e.name} — ${e.designation || 'Staff'} (${e.weekly_hours || 0}h/wk · Score: ${e.productivity_score || 0}%)`);
  }), [rows]);

  const openNew = () => {
    if (user?.role !== 'Admin') {
      toast("Access Denied: Only Admins can add employees.");
      return;
    }
    setForm(EMPTY); setEditingId(null); setModalOpen(true);
  };
  const openEdit = (e) => {
    if (user?.role !== 'Admin' && user?.role !== 'Project Manager') {
      toast("Access Denied: Only Admins and Project Managers can edit employees.");
      return;
    }
    setForm({ ...EMPTY, ...e }); setEditingId(e.id); setModalOpen(true);
  };

  const syncProjectsForEmployee = async (empName, selectedProjCodes) => {
    const { data: allProjs } = await supabase.from('projects').select('id, project_code, assigned_employees');
    if (!allProjs) return;
    
    for (const proj of allProjs) {
      const assignedList = proj.assigned_employees
        ? proj.assigned_employees.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const isAssigned = selectedProjCodes.includes(proj.project_code);
      
      let newList = [...assignedList];
      if (isAssigned) {
        if (!newList.includes(empName)) {
          newList.push(empName);
        }
      } else {
        newList = newList.filter(name => name !== empName);
      }
      
      const newAssignedEmployees = newList.join(', ');
      if (newAssignedEmployees !== (proj.assigned_employees || '')) {
        await supabase
          .from('projects')
          .update({ assigned_employees: newAssignedEmployees })
          .eq('id', proj.id);
      }
    }
  };

  const save = async () => {
    if (editingId) {
      if (user?.role !== 'Admin' && user?.role !== 'Project Manager') {
        toast("Access Denied: Only Admins and Project Managers can edit employees.");
        return;
      }
    } else {
      if (user?.role !== 'Admin') {
        toast("Access Denied: Only Admins can add employees.");
        return;
      }
    }
    try {
      let profileId = null;
      if (form.email) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', form.email)
          .maybeSingle();
        if (prof) profileId = prof.id;
      }
      const payload = { ...form, profile_id: profileId };

      if (editingId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true });
        const emp_code = 'EMP-' + String((count || 0) + 1).padStart(3, '0');
        const { error } = await supabase.from('employees').insert({ ...payload, emp_code });
        if (error) throw error;
      }

      const selectedProjCodes = form.assigned_projects
        ? form.assigned_projects.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      await syncProjectsForEmployee(form.name, selectedProjCodes);

      setModalOpen(false); load(); toast('Employee saved successfully.');
    } catch (err) { toast(err.message || 'Unable to save employee.'); }
  };
  const remove = async (id) => {
    if (user?.role !== 'Admin') {
      toast("Access Denied: Only Admins can delete employees.");
      return;
    }
    if (!confirm('Delete this employee?')) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { toast(error.message); return; }
    load(); toast('Employee deleted.');
  };

  const riskLabel = (w) => (w === 'Overloaded' ? 'High' : w === 'High' ? 'Medium' : 'Low');

  return (
    <div className="space-y-4">
      {/* Employee Workload & Level Graph */}
      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
        <div className="font-semibold text-[14.5px]">Employee Workload & Capacity Level</div>
        <div className="text-[12px] text-slate-500 mb-3">Workforce utilization breakdown</div>
        <div className="h-[180px]">
          <Bar data={empChartData} options={empChartOptions} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center justify-between mb-4">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employees, dept…" className="px-3 py-2 rounded-lg text-[13px] border border-slate-200 min-w-[220px]" />
        {canAdd && <button onClick={openNew} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-light"><Plus size={15} strokeWidth={2} /> Add Employee</button>}
      </div>

      <div className="bg-white border border-slate-200 rounded-[10px] shadow-sm overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-[11.5px] uppercase text-slate-500 border-b border-slate-200">
              {['Code', 'Name', 'Department', 'Designation', 'Projects', 'Daily', 'Weekly', 'Productivity', 'Workload', ''].map(h => <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-slate-100 last:border-none">
                <td className="px-3 py-2.5 font-mono-plex whitespace-nowrap">{e.emp_code}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><div className="font-semibold">{e.name}</div><div className="text-[11.5px] text-slate-500">{e.email}</div></td>
                <td className="px-3 py-2.5 whitespace-nowrap">{e.department}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{e.designation}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 max-w-[150px] truncate" title={e.assigned_projects}>{e.assigned_projects || '—'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{e.daily_hours}h</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{e.weekly_hours}h</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{e.productivity_score}%</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><Pill tone={riskTone(riskLabel(e.workload))}>{e.workload}</Pill></td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {canEdit && <button onClick={() => openEdit(e)} className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-500"><Pencil size={14} strokeWidth={1.9} /></button>}
                  {canDelete && <button onClick={() => remove(e.id)} className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-500"><Trash2 size={14} strokeWidth={1.9} /></button>}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={10} className="text-center text-slate-400 py-10">No employees found matching the search query or department filter. Click 'Add Employee' to register a new team member.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${editingId ? 'Edit' : 'New'} Employee`}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Save Employee</button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <F label="Name" full><input className="in" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Email"><input className="in" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></F>
          <F label="Phone"><input className="in" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></F>
          <F label="Department"><input className="in" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></F>
          <F label="Designation"><input className="in" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} /></F>
          <F label="Assign Projects" full>
            <div className="border border-slate-200 rounded-lg p-3 max-h-[140px] overflow-y-auto bg-slate-50/50 grid grid-cols-2 gap-2 mt-1">
              {projects.map(proj => {
                const assignedList = form.assigned_projects
                  ? form.assigned_projects.split(',').map(s => s.trim()).filter(Boolean)
                  : [];
                const isChecked = assignedList.includes(proj.project_code);
                const handleToggle = (checked) => {
                  let newList;
                  if (checked) {
                    newList = [...assignedList, proj.project_code];
                  } else {
                    newList = assignedList.filter(code => code !== proj.project_code);
                  }
                  setForm({ ...form, assigned_projects: newList.join(', ') });
                };
                return (
                  <label key={proj.id} className="flex items-center gap-2 text-[12.5px] cursor-pointer hover:bg-slate-100/80 p-1 rounded transition-all">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => handleToggle(e.target.checked)}
                      className="rounded text-teal focus:ring-teal border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="font-medium text-slate-700">{proj.name} ({proj.project_code})</span>
                  </label>
                );
              })}
              {!projects.length && <div className="text-slate-400 text-xs col-span-2">No projects available.</div>}
            </div>
          </F>
          <F label="Daily Hours"><input type="number" className="in" value={form.daily_hours} onChange={e => setForm({ ...form, daily_hours: Number(e.target.value) })} /></F>
          <F label="Weekly Hours"><input type="number" className="in" value={form.weekly_hours} onChange={e => setForm({ ...form, weekly_hours: Number(e.target.value) })} /></F>
          <F label="Productivity Score"><input type="number" className="in" value={form.productivity_score} onChange={e => setForm({ ...form, productivity_score: Number(e.target.value) })} /></F>
          <F label="Workload">
            <select className="in" value={form.workload} onChange={e => setForm({ ...form, workload: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Overloaded</option></select>
          </F>
        </div>
      </Modal>
      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}

function F({ label, children, full }) {
  return <div className={full ? 'col-span-2' : ''}><label className="block text-[12px] text-slate-500 mb-1 font-medium">{label}</label>{children}</div>;
}
