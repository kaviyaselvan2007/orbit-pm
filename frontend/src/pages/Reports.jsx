// src/pages/Reports.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../components/UI';
import { Download, FileText, Printer } from 'lucide-react';
import { attachRisk } from '../utils/riskEngine';
import { useAuth } from '../context/AuthContext';
import { filterProjects, filterEmployees } from '../utils/authFilters';

export default function Reports() {
  const { user } = useAuth();
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  const generatePreview = async () => {
    setLoading(true);

    try {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("*, clients(name)");
      if (projectsError) throw projectsError;

      const { data: employees, error: employeesError } = await supabase
        .from("employees")
        .select("*, profiles(role)");
      if (employeesError) throw employeesError;

      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*");
      if (clientsError) throw clientsError;

      const normalized = (projects || []).map(p => ({ ...p, client_name: p.clients?.name || '' }));
      const visibleEmployees = filterEmployees(employees || [], user);
      const visibleProjects = filterProjects(normalized, employees || [], user);
      const projectsWithRisk = attachRisk(visibleProjects, employees || []);

      const visibleClientIds = new Set(visibleProjects.map(p => p.client_id).filter(Boolean));
      const visibleClients = (clients || []).filter(c => visibleClientIds.has(c.id));

      const completed =
        projectsWithRisk.filter(p => p.status === "Completed").length || 0;

      const active =
        projectsWithRisk.filter(p => p.status === "Active").length || 0;

      const delayed =
        projectsWithRisk.filter(p => p.status === "Delayed").length || 0;

      const highRisk =
        projectsWithRisk.filter(p => p.risk?.level === "High").length || 0;

      const report = `
===============================
      ORBITPM WEEKLY REPORT
===============================

Date:
${new Date().toLocaleDateString()}

PROJECTS
-------------------------------
Total Projects      : ${projectsWithRisk.length}
Completed Projects  : ${completed}
Active Projects     : ${active}
Delayed Projects    : ${delayed}

EMPLOYEES
-------------------------------
Total Employees     : ${visibleEmployees.length}

CLIENTS
-------------------------------
Total Clients       : ${visibleClients.length}

RISK SUMMARY
-------------------------------
High Risk Projects  : ${highRisk}

Generated automatically by ORBITPM
`;

      setPreview(report);

      if (user?.weekly_report_ready !== false) {
        await supabase.from('notifications').insert({
          type: 'update',
          title: 'Weekly Report Ready',
          message: `A new weekly project status report has been successfully generated.`
        });
      }

      toast("Report generated successfully.");

    } catch (err) {
      console.error(err);
      toast("Unable to generate report: " + err.message);
    }

    setLoading(false);
  };

  const downloadCSV = async () => {
    try {
      const [{ data: projects, error: projectsError }, { data: employees, error: employeesError }] = await Promise.all([
        supabase.from("projects").select("*, clients(name)"),
        supabase.from("employees").select("*, profiles(role)"),
      ]);

      if (projectsError) throw projectsError;
      if (employeesError) throw employeesError;

      const visibleProjects = filterProjects(projects || [], employees || [], user);

      if (!visibleProjects || visibleProjects.length === 0) {
        toast("No data found.");
        return;
      }

      const csv = [
        [
          "Project",
          "Client",
          "Status",
          "Priority",
          "Progress"
        ],
        ...visibleProjects.map(p => [
          p.name,
          p.clients?.name || '',
          p.status,
          p.priority,
          p.progress
        ])
      ]
        .map(row => row.join(","))
        .join("\n");

      const blob = new Blob([csv], {
        type: "text/csv"
      });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;
      a.download = "OrbitPM_Report.csv";
      a.click();

      URL.revokeObjectURL(url);

      toast("CSV downloaded.");
    } catch (err) {
      console.error(err);
      toast("Error downloading CSV: " + err.message);
    }
  };


  return (
    <div>
      <h2 className="font-display font-bold text-[15px]">Weekly Report Generator</h2>
      <p className="text-[12.5px] text-slate-500 mb-4">
        Auto-compiled project summaries, client statistics, employee performance and risk insights — pulled live from the database.
      </p>

      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm mb-4.5 mb-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div className="font-semibold text-sm">Generate this week's report</div>
            <div className="text-[12px] text-slate-500 mt-0.5">Compiles current portfolio data into a downloadable report</div>
          </div>
          <div className="flex gap-2.5">
            <button onClick={downloadCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50">
              <Download size={15} strokeWidth={1.9} /> Download Excel (.csv)
            </button>
            <button onClick={generatePreview} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-light disabled:opacity-60">
              <FileText size={15} strokeWidth={1.9} /> {loading ? 'Generating…' : 'Generate PDF Report'}
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="font-display font-bold text-[15px]">Report Preview</div>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] font-semibold hover:bg-slate-50">
              <Printer size={14} strokeWidth={1.9} /> Print / Save as PDF
            </button>
          </div>
          <pre className="font-mono-plex text-[12.5px] whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-lg mt-2.5">{preview}</pre>
        </div>
      )}
    </div>
  );
}
