// src/pages/Effort.jsx
import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Pill, toast } from '../components/UI';
import { TriangleAlert, TrendingDown, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { filterEmployees } from '../utils/authFilters';

export default function Effort() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({ overloaded: [], underutilized: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', log_date: new Date().toISOString().slice(0, 10), task: '', hours: 8 });

  const load = async () => {
    const { data: logsData } = await supabase
      .from('work_logs')
      .select('*, employees(name)');

    const { data: employeesData } = await supabase
      .from('employees')
      .select('*, profiles(role)');

    const visibleEmployees = filterEmployees(employeesData || [], user);
    const visibleEmpIds = new Set(visibleEmployees.map(e => e.id));

    const mappedLogs = (logsData || [])
      .filter(l => visibleEmpIds.has(l.employee_id))
      .map(l => ({
        ...l,
        employee_name: l.employees?.name || 'Unknown'
      }));

    setLogs(mappedLogs);
    setEmployees(visibleEmployees);

    const overloaded = visibleEmployees.filter(e => e.workload === 'Overloaded' || Number(e.weekly_hours) > 40);
    const underutilized = visibleEmployees.filter(e => e.workload === 'Low' || Number(e.weekly_hours) < 18);

    setSummary({
      overloaded,
      underutilized,
    });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.employee_id) {
      toast('Please select an employee.');
      return;
    }
    const { error } = await supabase
      .from('work_logs')
      .insert([{
        employee_id: Number(form.employee_id),
        log_date: form.log_date,
        task: form.task || 'General work',
        hours: Number(form.hours)
      }]);

    if (error) {
      toast(error.message);
      return;
    }

    toast('Work log saved.');
    setModalOpen(false);
    load();
  };


  return (
    <div>
      <div className="font-semibold text-[15px]">Employee Effort Tracking</div>
      <div className="text-[12.5px] text-slate-500 mb-4">Daily work logs and automatic workload classification</div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[13.5px] mb-1 flex items-center gap-1.5"><TriangleAlert size={15} strokeWidth={1.9} className="text-amber" /> Overloaded Employees</div>
          {summary.overloaded?.length ? summary.overloaded.map(e => (
            <div key={e.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-none">
              <div><div className="font-semibold text-[13px]">{e.name}</div><div className="text-[11.5px] text-slate-500">{e.designation}</div></div>
              <Pill tone="red">{e.weekly_hours}h/wk</Pill>
            </div>
          )) : <div className="text-slate-400 text-sm py-3">No overloaded employees this week.</div>}
        </div>
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[13.5px] mb-1 flex items-center gap-1.5"><TrendingDown size={15} strokeWidth={1.9} className="text-slate-400" /> Underutilized Employees</div>
          {summary.underutilized?.length ? summary.underutilized.map(e => (
            <div key={e.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-none">
              <div><div className="font-semibold text-[13px]">{e.name}</div><div className="text-[11.5px] text-slate-500">{e.designation}</div></div>
              <Pill tone="amber">{e.weekly_hours}h/wk</Pill>
            </div>
          )) : <div className="text-slate-400 text-sm py-3">No underutilized employees this week.</div>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2.5">
          <div className="font-semibold text-[15px]">Work Log</div>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal text-white text-[12.5px] font-semibold hover:bg-teal-light"><Plus size={14} strokeWidth={2} /> Log Hours</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead><tr className="text-[11.5px] uppercase text-slate-500 border-b border-slate-200">
              {['Date', 'Employee', 'Task', 'Hours'].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-slate-100 last:border-none">
                  <td className="px-3 py-2">{l.log_date}</td><td className="px-3 py-2">{l.employee_name}</td>
                  <td className="px-3 py-2">{l.task}</td><td className="px-3 py-2">{l.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Hours" subtitle="Record a daily work entry"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Save Entry</button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[12px] text-slate-500 mb-1">Date</label><input type="date" className="in" value={form.log_date} onChange={e => setForm({ ...form, log_date: e.target.value })} /></div>
          <div><label className="block text-[12px] text-slate-500 mb-1">Employee</label>
            <select className="in" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">— Select —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="block text-[12px] text-slate-500 mb-1">Task</label><input className="in" placeholder="What did you work on?" value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} /></div>
          <div><label className="block text-[12px] text-slate-500 mb-1">Hours</label><input type="number" className="in" value={form.hours} onChange={e => setForm({ ...form, hours: Number(e.target.value) })} /></div>
        </div>
      </Modal>
      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}
