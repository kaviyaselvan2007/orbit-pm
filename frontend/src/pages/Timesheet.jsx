// src/pages/Timesheet.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Pill, toast } from '../components/UI';
import Modal from '../components/Modal';
import { Save, Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SIZES_REF = [
  { size: 'XS', points: '1-2', low: 2, high: 4, duration: 'Same day', example: 'Label change, field addition, report filter' },
  { size: 'S', points: '3-5', low: 8, high: 16, duration: '1-2 days', example: 'New parameter, simple workflow, validation' },
  { size: 'M', points: '8-13', low: 24, high: 40, duration: '3-5 days', example: 'New screen enhancement, API integration, moderate customization' },
  { size: 'L', points: '20-30', low: 56, high: 80, duration: '1-2 weeks', example: 'End-to-end WBS, multi-system integration' },
  { size: 'XL', points: '40+', low: 120, high: 160, duration: '2-4 weeks', example: 'Large scale modules, complex database redesign' }
];

const SCORE_SIZE_REF = [
  { min: 0, max: 3, size: 'XS' },
  { min: 4, max: 6, size: 'S' },
  { min: 7, max: 9, size: 'M' },
  { min: 10, max: 12, size: 'L' },
  { min: 13, max: 100, size: 'XL' }
];

export default function Timesheet() {
  const { user } = useAuth();
  const [outcomes, setOutcomes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rate, setRate] = useState(() => Number(localStorage.getItem('blended_rate') || 35.00));
  const [capacity, setCapacity] = useState(() => Number(localStorage.getItem('hours_capacity') || 8));
  
  // New outcome form
  const [modalOpen, setModalOpen] = useState(false);
  const [newOutcome, setNewOutcome] = useState({ project_id: '', outcome_code: '', title: '' });

  const loadData = async () => {
    try {
      const [{ data: outcomesRows }, { data: projectsRows }, { data: employeeRows }] = await Promise.all([
        supabase.from('project_outcomes').select('*').order('id'),
        supabase.from('projects').select('id, name, project_code').order('name'),
        supabase.from('employees').select('id, name').order('name')
      ]);

      setProjects(projectsRows || []);
      setEmployees(employeeRows || []);

      const parsed = (outcomesRows || []).map(row => {
        let business = row.business_score || 0;
        let technical = row.technical_score || 0;
        let integration = row.integration_score || 0;
        let testing = row.testing_score || 0;
        let dataScore = row.data_score || 0;
        let bottomUp = row.bottom_up_hours || 0;

        if (row.description && row.description.startsWith('{')) {
          try {
            const meta = JSON.parse(row.description);
            if (meta.business_score !== undefined) {
              business = meta.business_score;
              technical = meta.technical_score;
              integration = meta.integration_score;
              testing = meta.testing_score;
              dataScore = meta.data_score;
              bottomUp = meta.bottom_up_hours;
            }
          } catch (e) {}
        }

        return {
          ...row,
          business_score: business,
          technical_score: technical,
          integration_score: integration,
          testing_score: testing,
          data_score: dataScore,
          bottom_up_hours: bottomUp
        };
      });

      setOutcomes(parsed);
    } catch (err) {
      toast(err.message || 'Error loading timesheet data.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRateChange = (val) => {
    setRate(val);
    localStorage.setItem('blended_rate', String(val));
  };

  const handleCapacityChange = (val) => {
    setCapacity(val);
    localStorage.setItem('hours_capacity', String(val));
  };

  const handleCellChange = (id, field, val) => {
    setOutcomes(prev => prev.map(o => {
      if (o.id === id) {
        return { ...o, [field]: val };
      }
      return o;
    }));
  };

  const calculateRowDetails = (row) => {
    const total = Number(row.business_score || 0) +
                  Number(row.technical_score || 0) +
                  Number(row.integration_score || 0) +
                  Number(row.testing_score || 0) +
                  Number(row.data_score || 0);

    let suggestedSize = 'XS';
    for (const range of SCORE_SIZE_REF) {
      if (total >= range.min && total <= range.max) {
        suggestedSize = range.size;
        break;
      }
    }

    const ref = SIZES_REF.find(s => s.size === suggestedSize) || SIZES_REF[0];
    const costLow = ref.low * rate;
    const costHigh = ref.high * rate;

    let path = 'Delivery Lead';
    if (total >= 7 && total <= 9) {
      path = 'Delivery Lead + Account Manager';
    } else if (total >= 10) {
      path = 'Formal Change Request';
    }

    return { total, suggestedSize, hoursLow: ref.low, hoursHigh: ref.high, costLow, costHigh, path };
  };

  const handleSaveRow = async (row) => {
    try {
      const { total, suggestedSize } = calculateRowDetails(row);

      const descriptionJSON = JSON.stringify({
        business_score: Number(row.business_score || 0),
        technical_score: Number(row.technical_score || 0),
        integration_score: Number(row.integration_score || 0),
        testing_score: Number(row.testing_score || 0),
        data_score: Number(row.data_score || 0),
        bottom_up_hours: Number(row.bottom_up_hours || 0)
      });

      const payload = {
        title: row.title,
        approval_status: row.approval_status,
        deliverable_status: row.deliverable_status,
        actual_hours: Number(row.actual_hours || 0),
        tshirt_size: suggestedSize,
        description: descriptionJSON,
        business_score: Number(row.business_score || 0),
        technical_score: Number(row.technical_score || 0),
        integration_score: Number(row.integration_score || 0),
        testing_score: Number(row.testing_score || 0),
        data_score: Number(row.data_score || 0),
        bottom_up_hours: Number(row.bottom_up_hours || 0),
        assignee: row.assignee || ''
      };

      const { error } = await supabase
        .from('project_outcomes')
        .update(payload)
        .eq('id', row.id);

      if (error) throw error;
      toast('Row saved successfully.');
      loadData();
    } catch (err) {
      toast(err.message || 'Error saving row.');
    }
  };

  const handleAddOutcome = async () => {
    if (!newOutcome.project_id || !newOutcome.outcome_code || !newOutcome.title) {
      toast('Please fill in all outcome fields.');
      return;
    }

    try {
      const { error } = await supabase
        .from('project_outcomes')
        .insert([{
          project_id: Number(newOutcome.project_id),
          outcome_code: newOutcome.outcome_code.trim(),
          title: newOutcome.title.trim(),
          effort_version: 'Original',
          approval_status: 'Approved',
          deliverable_status: 'Not Started',
          tshirt_size: 'XS'
        }]);

      if (error) throw error;
      toast('Outcome added successfully.');
      setModalOpen(false);
      setNewOutcome({ project_id: '', outcome_code: '', title: '' });
      loadData();
    } catch (err) {
      toast(err.message || 'Error creating outcome.');
    }
  };

  const handleDeleteOutcome = async (id) => {
    if (!confirm('Delete this outcome estimate? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('project_outcomes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast('Outcome deleted.');
      loadData();
    } catch (err) {
      toast(err.message || 'Error deleting outcome.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="font-semibold text-[15px] flex items-center gap-2">
          <FileSpreadsheet size={18} strokeWidth={2} className="text-teal" /> Common Timesheet
        </div>
      </div>

      {/* Global Config Card */}
      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Blended Client Rate ($/hr)</label>
          <input
            type="number"
            className="in font-mono-plex"
            value={rate}
            onChange={e => handleRateChange(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hours per Day (Capacity)</label>
          <input
            type="number"
            className="in font-mono-plex"
            value={capacity}
            onChange={e => handleCapacityChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* References Grids */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* T-Shirt Sizing Ref */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-bold text-[13px] text-slate-800 mb-3 uppercase tracking-wider border-b pb-1.5">1. T-Shirt Sizing Reference Grid</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border border-slate-100">
              <thead>
                <tr className="bg-slate-50 text-[10.5px] font-bold text-slate-500 border-b">
                  <th className="px-2.5 py-1.5 text-left">Size</th>
                  <th className="px-2.5 py-1.5 text-left">Story Points</th>
                  <th className="px-2.5 py-1.5 text-left">Hours Low</th>
                  <th className="px-2.5 py-1.5 text-left">Hours High</th>
                  <th className="px-2.5 py-1.5 text-left">Typical Duration</th>
                  <th className="px-2.5 py-1.5 text-left">Example</th>
                </tr>
              </thead>
              <tbody>
                {SIZES_REF.map(s => (
                  <tr key={s.size} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-2.5 py-1.5 font-bold text-teal">{s.size}</td>
                    <td className="px-2.5 py-1.5 font-mono-plex">{s.points}</td>
                    <td className="px-2.5 py-1.5 font-mono-plex">{s.low}</td>
                    <td className="px-2.5 py-1.5 font-mono-plex">{s.high}</td>
                    <td className="px-2.5 py-1.5">{s.duration}</td>
                    <td className="px-2.5 py-1.5 text-slate-500 max-w-[200px] truncate" title={s.example}>{s.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Score to suggested size */}
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-bold text-[13px] text-slate-800 mb-3 uppercase tracking-wider border-b pb-1.5">Complexity Score Limits</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border border-slate-100">
              <thead>
                <tr className="bg-slate-50 text-[10.5px] font-bold text-slate-500 border-b">
                  <th className="px-2.5 py-1.5 text-left">Min Score</th>
                  <th className="px-2.5 py-1.5 text-left">Max Score</th>
                  <th className="px-2.5 py-1.5 text-left">Suggested Size</th>
                </tr>
              </thead>
              <tbody>
                {SCORE_SIZE_REF.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-2.5 py-1.5 font-mono-plex">{r.min}</td>
                    <td className="px-2.5 py-1.5 font-mono-plex">{r.max === 100 ? '13+' : r.max}</td>
                    <td className="px-2.5 py-1.5 font-bold text-amber-600">{r.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Estimates Spreadsheet Grid */}
      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3 border-b pb-2">
          <div className="font-bold text-[13px] text-slate-800 uppercase tracking-wider">2. Per-Outcome estimates & calculator</div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal text-white text-[12px] font-semibold hover:bg-teal-light"
          >
            <Plus size={14} /> Add Outcome
          </button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-[12px] border border-slate-200 border-collapse table-fixed">
            <thead>
              <tr className="bg-navy-950 text-white text-[10.5px] uppercase border-b border-slate-300">
                <th className="p-2 border border-slate-800 w-[120px]">Outcome Code</th>
                <th className="p-2 border border-slate-800 w-[90px]">Version</th>
                <th className="p-2 border border-slate-800 w-[100px]">Status</th>
                <th className="p-2 border border-slate-800 w-[200px]">Outcome Title</th>
                <th className="p-2 border border-slate-800 w-[130px]">Assignee</th>
                <th className="p-2 border border-slate-800 w-[65px]" title="Business Score">Bus</th>
                <th className="p-2 border border-slate-800 w-[65px]" title="Technical Score">Tech</th>
                <th className="p-2 border border-slate-800 w-[65px]" title="Integration Score">Int</th>
                <th className="p-2 border border-slate-800 w-[65px]" title="Testing Score">Test</th>
                <th className="p-2 border border-slate-800 w-[65px]" title="Data Score">Data</th>
                <th className="p-2 border border-slate-800 w-[65px]" title="Total Complexity Score">Total</th>
                <th className="p-2 border border-slate-800 w-[65px]">Size</th>
                <th className="p-2 border border-slate-800 w-[80px]">Hrs Low</th>
                <th className="p-2 border border-slate-800 w-[80px]">Hrs High</th>
                <th className="p-2 border border-slate-800 w-[95px]">Cost Low ($)</th>
                <th className="p-2 border border-slate-800 w-[95px]">Cost High ($)</th>
                <th className="p-2 border border-slate-800 w-[110px]">Bottom-Up H</th>
                <th className="p-2 border border-slate-800 w-[150px]">Approval Path</th>
                <th className="p-2 border border-slate-800 w-[90px]">Actual Hrs</th>
                <th className="p-2 border border-slate-800 w-[110px]">Delivery State</th>
                <th className="p-2 border border-slate-800 w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map(row => {
                const { total, suggestedSize, hoursLow, hoursHigh, costLow, costHigh, path } = calculateRowDetails(row);

                return (
                  <tr key={row.id} className="hover:bg-slate-50 border-b border-slate-200">
                    {/* Code */}
                    <td className="p-1 border border-slate-200 font-mono-plex text-center truncate">{row.outcome_code}</td>
                    
                    {/* Version */}
                    <td className="p-1 border border-slate-200 text-center">{row.effort_version || 'Original'}</td>
                    
                    {/* Approval Status */}
                    <td className="p-1 border border-slate-200">
                      <select
                        value={row.approval_status}
                        onChange={e => handleCellChange(row.id, 'approval_status', e.target.value)}
                        className="w-full bg-transparent outline-none py-0.5"
                      >
                        <option>Pending</option>
                        <option>Approved</option>
                        <option>Rejected</option>
                      </select>
                    </td>

                    {/* Title */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="text"
                        value={row.title}
                        onChange={e => handleCellChange(row.id, 'title', e.target.value)}
                        className="w-full bg-transparent outline-none px-1 border border-transparent hover:border-slate-300 focus:border-teal rounded py-0.5"
                      />
                    </td>

                    {/* Assignee */}
                    <td className="p-1 border border-slate-200">
                      <select
                        value={row.assignee || ''}
                        onChange={e => handleCellChange(row.id, 'assignee', e.target.value)}
                        className="w-full bg-transparent outline-none py-0.5 text-slate-700"
                      >
                        <option value="">— Unassigned —</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>{emp.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Business */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.business_score}
                        onChange={e => handleCellChange(row.id, 'business_score', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Technical */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.technical_score}
                        onChange={e => handleCellChange(row.id, 'technical_score', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Integration */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.integration_score}
                        onChange={e => handleCellChange(row.id, 'integration_score', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Testing */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.testing_score}
                        onChange={e => handleCellChange(row.id, 'testing_score', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Data */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.data_score}
                        onChange={e => handleCellChange(row.id, 'data_score', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Total (Calc) */}
                    <td className="p-1 border border-slate-200 text-center font-bold font-mono-plex bg-slate-50">{total}</td>

                    {/* Size (Calc) */}
                    <td className="p-1 border border-slate-200 text-center font-bold text-teal bg-slate-50">{suggestedSize}</td>

                    {/* Hours Low (Calc) */}
                    <td className="p-1 border border-slate-200 text-center font-mono-plex bg-slate-50">{hoursLow}h</td>

                    {/* Hours High (Calc) */}
                    <td className="p-1 border border-slate-200 text-center font-mono-plex bg-slate-50">{hoursHigh}h</td>

                    {/* Cost Low (Calc) */}
                    <td className="p-1 border border-slate-200 text-right pr-2 font-mono-plex bg-slate-50">${costLow.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>

                    {/* Cost High (Calc) */}
                    <td className="p-1 border border-slate-200 text-right pr-2 font-mono-plex bg-slate-50">${costHigh.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>

                    {/* Bottom-Up H */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.bottom_up_hours}
                        onChange={e => handleCellChange(row.id, 'bottom_up_hours', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Approval Path (Calc) */}
                    <td className="p-1 border border-slate-200 text-[11px] truncate bg-slate-50" title={path}>{path}</td>

                    {/* Actual Hrs */}
                    <td className="p-1 border border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.actual_hours}
                        onChange={e => handleCellChange(row.id, 'actual_hours', Number(e.target.value))}
                        className="w-full text-center bg-transparent outline-none font-mono-plex py-0.5"
                      />
                    </td>

                    {/* Delivery State */}
                    <td className="p-1 border border-slate-200">
                      <select
                        value={row.deliverable_status}
                        onChange={e => handleCellChange(row.id, 'deliverable_status', e.target.value)}
                        className="w-full bg-transparent outline-none py-0.5 text-[11px] font-semibold"
                      >
                        <option>Not Started</option>
                        <option>In Progress</option>
                        <option>Done</option>
                        <option>Blocked</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="p-1 border border-slate-200 text-center flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleSaveRow(row)}
                        title="Save changes"
                        className="p-1 hover:bg-slate-200 rounded text-teal"
                      >
                        <Save size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteOutcome(row.id)}
                        title="Delete estimate"
                        className="p-1 hover:bg-slate-200 rounded text-rose-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {outcomes.length === 0 && (
                <tr>
                  <td colSpan={20} className="text-center text-slate-400 py-10">No estimates found. Add a project outcome using the button above to begin estimating.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Outcome Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Outcome Estimate" subtitle="Create a project outcome to start T-shirt sizing estimation."
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
          <button onClick={handleAddOutcome} className="px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold">Add Outcome</button>
        </>}>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2">
            <label className="block text-[12px] text-slate-500 mb-1 font-medium">Select Project</label>
            <select
              className="in"
              value={newOutcome.project_id}
              onChange={e => setNewOutcome(prev => ({ ...prev, project_id: e.target.value }))}
            >
              <option value="">— Select Project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.project_code})</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[12px] text-slate-500 mb-1 font-medium">Outcome Code</label>
            <input
              className="in font-mono-plex"
              placeholder="e.g. SLG-POSENH-2"
              value={newOutcome.outcome_code}
              onChange={e => setNewOutcome(prev => ({ ...prev, outcome_code: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[12px] text-slate-500 mb-1 font-medium">Outcome Title</label>
            <input
              className="in"
              placeholder="e.g. Auto-Cancel Short-Picked Lines"
              value={newOutcome.title}
              onChange={e => setNewOutcome(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
      <style>{`.in{width:100%;padding:.5rem .6rem;border-radius:.45rem;font-size:.83rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}
