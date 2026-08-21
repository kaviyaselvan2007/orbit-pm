// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { supabase } from '../lib/supabaseClient';
import { attachRisk } from '../utils/riskEngine';
import { StatCard, Pill, riskTone, statusTone, priorityTone, toast } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { filterEmployees, filterProjects, filterNotifications } from '../utils/authFilters';
import { buildNameTooltipOptions } from '../utils/chartTooltips';
import {
  Clock, Plus, TriangleAlert, TrendingDown, FolderKanban,
  Users, Building2, ClipboardCheck, ArrowRight, Activity, ShieldAlert, CheckCircle2, Check
} from 'lucide-react';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const loadData = async () => {
    const [{ data: projects }, { data: employeesRaw }, { data: clients }] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('employees').select('*, profiles(role)'),
      supabase.from('clients').select('*'),
    ]);
    let employees = employeesRaw;

    const visibleEmployees = filterEmployees(employees || [], user);
    const visibleProjects = filterProjects(projects || [], employees || [], user);
    const withRisk = attachRisk(visibleProjects, employees || []);

    const statusCounts = { Active: 0, Completed: 0, Delayed: 0, 'On Hold': 0 };
    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    withRisk.forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      if (p.risk && p.risk.level) {
        riskCounts[p.risk.level] = (riskCounts[p.risk.level] || 0) + 1;
      }
    });

    // Find current user's employee record (or matching by email)
    let userEmployee = (employees || []).find(e => e.profile_id === user.id) ||
                       (employees || []).find(e => e.email?.toLowerCase() === user.email?.toLowerCase());

    // Auto-create an employee record if none exists for this user
    if (!userEmployee && user?.id) {
      try {
        // Query actual count to generate a collision-free emp_code
        const { count: empCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });
        const freshEmpCode = 'EMP-' + String((empCount || 0) + 1).padStart(3, '0');

        const { data: newEmp, error: insertErr } = await supabase
          .from('employees')
          .insert([{
            name: user.name || user.email,
            email: user.email,
            emp_code: freshEmpCode,
            department: user.department || null,
            designation: user.designation || null,
            profile_id: user.id,
            workload: 'Low',
            productivity_score: 0,
            weekly_hours: 0,
            daily_hours: 0,
          }])
          .select()
          .single();

        if (insertErr) {
          console.error('[Dashboard] Employee auto-create failed:', insertErr.message);
        } else if (newEmp) {
          userEmployee = newEmp;
          employees = [...(employees || []), newEmp];
        }
      } catch (_e) {
        console.error('[Dashboard] Employee auto-create exception:', _e);
      }

      // Final fallback: fetch by profile_id or email in case it was just created
      if (!userEmployee) {
        const { data: retryEmp } = await supabase
          .from('employees')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (retryEmp) {
          userEmployee = retryEmp;
        } else if (user.email) {
          const { data: emailEmp } = await supabase
            .from('employees')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          if (emailEmp) userEmployee = emailEmp;
        }
      }
    }

    const userEmpName = userEmployee?.name?.toLowerCase() || '';
    const userName = user.name?.toLowerCase() || '';
    const userAssignedProjectsList = (userEmployee?.assigned_projects || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const userProjects = withRisk.filter(p => {
      const assignedNames = (p.assigned_employees || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const isProjectAssignedToUser = (p.project_code && userAssignedProjectsList.includes(p.project_code.toLowerCase())) ||
                                      (p.name && userAssignedProjectsList.includes(p.name.toLowerCase()));
      return (userEmpName && assignedNames.includes(userEmpName)) ||
             (userName && assignedNames.includes(userName)) ||
             isProjectAssignedToUser;
    });

    const workloadCounts = { Low: 0, Medium: 0, High: 0, Overloaded: 0 };
    visibleEmployees.forEach(e => {
      workloadCounts[e.workload || 'Low'] = (workloadCounts[e.workload || 'Low'] || 0) + 1;
    });

    // --- Live Notifications Generator ---
    let generatedNew = false;
    if (user?.deadline_reminders !== false) {
      if (user?.workload_alerts !== false) {
        for (const emp of visibleEmployees || []) {
          if (emp.workload === 'Overloaded' || Number(emp.weekly_hours) > 40) {
            const title = `Workload Alert: ${emp.name}`;
            const message = `${emp.name} is overloaded with ${emp.weekly_hours} hours/week.`;
            const { data: exists } = await supabase.from('notifications').select('id').eq('title', title).limit(1);
            if (!exists || exists.length === 0) {
              await supabase.from('notifications').insert({ type: 'warn', title, message });
              generatedNew = true;
            }
          }
        }
      }
    }

    if (user?.high_risk_warnings !== false) {
      for (const p of withRisk) {
        if (p.risk.level === 'High') {
          const title = `High-Risk Alert: ${p.name}`;
          const message = `${p.name} is classified as High Risk: ${p.risk.reasons.join('; ')}`;
          const { data: exists } = await supabase.from('notifications').select('id').eq('title', title).limit(1);
          if (!exists || exists.length === 0) {
            await supabase.from('notifications').insert({ type: 'risk', title, message });
            generatedNew = true;
          }
        }
      }
    }

    if (user?.deadline_reminders !== false) {
      for (const p of visibleProjects || []) {
        if (p.status !== 'Completed' && p.end_date) {
          const diffTime = new Date(p.end_date) - new Date();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 7) {
            const title = `Deadline Reminder: ${p.name}`;
            const message = `${p.name} is approaching its deadline on ${p.end_date}.`;
            const { data: exists } = await supabase.from('notifications').select('id').eq('title', title).limit(1);
            if (!exists || exists.length === 0) {
              await supabase.from('notifications').insert({ type: 'update', title, message });
              generatedNew = true;
            }
          }
        }
      }
    }

    const { data: notifs } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    const filteredNotifs = filterNotifications(notifs || [], visibleProjects, visibleEmployees);

    const visibleClientIds = new Set(visibleProjects.map(p => p.client_id).filter(Boolean));
    const totalClientsCount = (clients || []).filter(c => visibleClientIds.has(c.id)).length;

    setStats({
      totalProjects: visibleProjects.length,
      activeProjects: statusCounts.Active,
      completedProjects: statusCounts.Completed,
      delayedProjects: statusCounts.Delayed,
      highRiskProjects: riskCounts.High,
      totalClients: (user.role === 'Admin' || user.role === 'Project Manager') ? (clients || []).length : totalClientsCount,
      totalEmployees: visibleEmployees.length,
      statusCounts,
      riskCounts,
      workloadCounts,
      userEmployee,
      userProjects,
      projects: withRisk,
      employees: visibleEmployees,
      clients: clients || []
    });
    setNotifications(filteredNotifs.slice(0, 5));
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (!stats) return <div className="text-slate-400">Loading dashboard…</div>;

  // Render dashboard based on role
  return (
    <div className="space-y-6">
      {/* Allocated Role Indicator */}
      <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal text-white shadow-sm flex-none">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">
              Welcome, {user?.name || 'User'}
            </h2>
            <p className="text-[11.5px] text-slate-500">
              Allocated Workspace Role: <span className="font-semibold text-slate-700">{user?.role || 'Employee'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={user?.role === 'Admin' ? 'teal' : user?.role === 'Project Manager' ? 'amber' : 'blue'}>
            {user?.role || 'Employee'}
          </Pill>
        </div>
      </div>

      {user?.role === 'Admin' && (
        <AdminDashboardView
          key="admin-view"
          stats={stats}
          notifications={notifications}
          navigate={navigate}
          onLogSave={loadData}
          authUser={user}
        />
      )}

      {user?.role === 'Project Manager' && (
        <PMDashboardView
          key="pm-view"
          stats={stats}
          notifications={notifications}
          navigate={navigate}
          onLogSave={loadData}
          authUser={user}
        />
      )}

      {user?.role === 'Employee' && (
        <EmployeeDashboardView
          key="employee-view"
          stats={stats}
          notifications={notifications}
          navigate={navigate}
          onLogSave={loadData}
          authUser={user}
        />
      )}
    </div>
  );
}

/* ==========================================
   ADMIN DASHBOARD VIEW
   ========================================== */
function AdminDashboardView({ stats, notifications, navigate, onLogSave, authUser }) {
  const statusData = {
    labels: Object.keys(stats.statusCounts),
    datasets: [{ data: Object.values(stats.statusCounts), backgroundColor: ['#0F6E7C', '#2E9E5B', '#D5514C', '#93A0B8'], borderRadius: 6 }],
  };

  const statusOptions = buildNameTooltipOptions((category) => {
    return (stats.projects || [])
      .filter(p => p.status === category)
      .map(p => `${p.name} (${p.project_code || 'N/A'})`);
  });

  const workloadData = {
    labels: ['Low', 'Medium', 'High', 'Overloaded'],
    datasets: [{
      data: [
        stats.workloadCounts.Low || 0,
        stats.workloadCounts.Medium || 0,
        stats.workloadCounts.High || 0,
        stats.workloadCounts.Overloaded || 0
      ],
      backgroundColor: ['#2E9E5B', '#E2A33D', '#D5514C', '#952A25'],
      borderRadius: 6
    }]
  };

  const workloadOptions = buildNameTooltipOptions((category) => {
    return (stats.employees || [])
      .filter(e => (e.workload || 'Low') === category)
      .map(e => `${e.name} — ${e.designation || 'Staff'} (${e.weekly_hours || 0}h/wk)`);
  });

  // Client Level Chart Data & Options
  const clientRiskCounts = { Low: 0, Medium: 0, High: 0 };
  (stats.clients || []).forEach(c => {
    const level = c.risk_level || 'Low';
    clientRiskCounts[level] = (clientRiskCounts[level] || 0) + 1;
  });

  const clientLevelData = {
    labels: ['Low Risk', 'Medium Risk', 'High Risk'],
    datasets: [{
      data: [clientRiskCounts.Low, clientRiskCounts.Medium, clientRiskCounts.High],
      backgroundColor: ['#0F6E7C', '#E2A33D', '#D5514C'],
      borderRadius: 6
    }]
  };

  const clientLevelOptions = buildNameTooltipOptions((category) => {
    const levelKey = category.replace(' Risk', '');
    return (stats.clients || [])
      .filter(c => (c.risk_level || 'Low') === levelKey)
      .map(c => `${c.name}${c.company ? ' (' + c.company + ')' : ''}${c.contact_person ? ' · Contact: ' + c.contact_person : ''}`);
  });

  // Employee Performance Level Chart Data & Options
  const empTiers = { 'High Performer (80-100%)': [], 'Steady (50-79%)': [], 'Needs Attention (<50%)': [] };
  (stats.employees || []).forEach(e => {
    const score = Number(e.productivity_score) || 0;
    if (score >= 80) empTiers['High Performer (80-100%)'].push(e);
    else if (score >= 50) empTiers['Steady (50-79%)'].push(e);
    else empTiers['Needs Attention (<50%)'].push(e);
  });

  const empLevelData = {
    labels: ['High Performer (80-100%)', 'Steady (50-79%)', 'Needs Attention (<50%)'],
    datasets: [{
      data: [
        empTiers['High Performer (80-100%)'].length,
        empTiers['Steady (50-79%)'].length,
        empTiers['Needs Attention (<50%)'].length
      ],
      backgroundColor: ['#2E9E5B', '#3E6FD9', '#D5514C'],
      borderRadius: 6
    }]
  };

  const empLevelOptions = buildNameTooltipOptions((category) => {
    return (empTiers[category] || []).map(e => `${e.name} — ${e.designation || 'Staff'} (Score: ${e.productivity_score || 0}%)`);
  });

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard label="Total Projects" value={stats.totalProjects} accent="#3E6FD9" onClick={() => navigate('/projects')} />
        <StatCard label="Active Projects" value={stats.activeProjects} accent="#0F6E7C" onClick={() => navigate('/projects', { state: { statusFilter: 'Active' } })} />
        <StatCard label="Total Clients" value={stats.totalClients} accent="#7C5CD9" onClick={() => navigate('/clients')} />
        <StatCard label="Total Employees" value={stats.totalEmployees} accent="#1B2436" onClick={() => navigate('/employees')} />
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div key="admin-box-1" className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[14.5px]">Resource Workload Allocation</div>
          <div className="text-[12px] text-slate-500 mb-3">Workforce utilization</div>
          <div className="h-[200px]">
            <Bar key="admin-workload-bar" data={workloadData} options={workloadOptions} />
          </div>
        </div>
        <div key="admin-box-2" className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[14.5px]">Projects by Status</div>
          <div className="text-[12px] text-slate-500 mb-3">Vitals from active deliverables</div>
          <div className="h-[200px]">
            <Bar key="admin-status-bar" data={statusData} options={statusOptions} />
          </div>
        </div>
        <div key="admin-box-3" className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[14.5px]">Client Risk & Engagement Levels</div>
          <div className="text-[12px] text-slate-500 mb-3">Portfolio breakdown by client tier</div>
          <div className="h-[200px]">
            <Bar key="admin-client-bar" data={clientLevelData} options={clientLevelOptions} />
          </div>
        </div>
        <div key="admin-box-4" className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[14.5px]">Employee Performance Levels</div>
          <div className="text-[12px] text-slate-500 mb-3">Productivity tier distribution</div>
          <div className="h-[200px]">
            <Bar key="admin-emp-bar" data={empLevelData} options={empLevelOptions} />
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid md:grid-cols-3 gap-4">
        <div key="admin-bottom-1" className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm h-full flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="font-semibold text-[14.5px]">System Alerts & Logs</div>
              <div className="text-[12px] text-slate-500">Latest resource warnings</div>
            </div>
            <button onClick={() => navigate('/notifications')} className="text-[12px] font-semibold text-teal hover:underline">View all</button>
          </div>
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 notif-scroll">
            {notifications.map(n => (
              <div key={n.id} className="p-3 bg-slate-50 border-l-4 rounded-r-lg flex justify-between items-start gap-4 text-[13px]"
                style={{ borderLeftColor: n.type === 'risk' ? '#D5514C' : n.type === 'warn' ? '#E2A33D' : '#0F6E7C' }}>
                <div>
                  <div className="font-semibold text-slate-700">{n.title}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{n.message}</div>
                </div>
                <div className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
            {!notifications.length && <div key="empty-admin-notifs" className="text-slate-400 text-sm py-4">No warnings at this time.</div>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm h-full flex flex-col justify-between">
          <div>
            <div className="font-semibold text-[14.5px] mb-1">Administrative Operations</div>
            <div className="text-[12px] text-slate-500 mb-4">Quick links to expand directory settings</div>
          </div>
          <div className="space-y-2">
            <button onClick={() => navigate('/projects')} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[13px] font-medium text-slate-700">
              <span className="flex items-center gap-2"><FolderKanban size={15} className="text-slate-500" /> Create Project</span> <ArrowRight size={13} />
            </button>
            <button onClick={() => navigate('/employees')} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[13px] font-medium text-slate-700">
              <span className="flex items-center gap-2"><Users size={15} className="text-slate-500" /> Register Employee</span> <ArrowRight size={13} />
            </button>
            <button onClick={() => navigate('/clients')} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[13px] font-medium text-slate-700">
              <span className="flex items-center gap-2"><Building2 size={15} className="text-slate-500" /> Register Client</span> <ArrowRight size={13} />
            </button>
            <button onClick={() => navigate('/reports')} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[13px] font-medium text-slate-700">
              <span className="flex items-center gap-2"><ClipboardCheck size={15} className="text-slate-500" /> View Analytics Report</span> <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div>
          <QuickLogHoursCard userEmployee={stats.userEmployee} onLogSave={onLogSave} authUser={authUser} />
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   PROJECT MANAGER DASHBOARD VIEW
   ========================================== */
function PMDashboardView({ stats, notifications, navigate, onLogSave, authUser }) {
  const statusData = {
    labels: Object.keys(stats.statusCounts),
    datasets: [{ data: Object.values(stats.statusCounts), backgroundColor: ['#0F6E7C', '#2E9E5B', '#D5514C', '#93A0B8'], borderRadius: 6 }],
  };

  const statusOptions = buildNameTooltipOptions((category) => {
    return (stats.projects || [])
      .filter(p => p.status === category)
      .map(p => `${p.name} (${p.project_code || 'N/A'})`);
  });

  // Delayed / high-risk project watch list
  const pmWatchlist = stats.projects.filter(p => p.status === 'Delayed' || p.risk?.level === 'High');

  return (
    <div className="space-y-6">
      {/* PM Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard label="Active Projects" value={stats.activeProjects} accent="#0F6E7C" onClick={() => navigate('/projects', { state: { statusFilter: 'Active' } })} />
        <StatCard label="Delayed Projects" value={stats.delayedProjects} accent="#D5514C" onClick={() => navigate('/projects', { state: { statusFilter: 'Delayed' } })} />
        <StatCard label="High-Risk Projects" value={stats.highRiskProjects} accent="#E2A33D" onClick={() => navigate('/risk')} />
        <StatCard label="Total Clients" value={stats.totalClients} accent="#7C5CD9" onClick={() => navigate('/clients')} />
      </div>

      {/* PM specific watchlist & status bar */}
      <div className="grid md:grid-cols-3 gap-4">
        <div key="pm-wl-box" className="md:col-span-2 bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="font-semibold text-[14.5px] mb-1 text-slate-800">Delayed & At-Risk Projects Watchlist</div>
          <div className="text-[12px] text-slate-500 mb-4 border-b pb-2">Critical path deliverables requiring mitigation</div>
          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 notif-scroll">
            {pmWatchlist.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-slate-200 transition-all bg-slate-50/30 gap-3">
                <div>
                  <div className="font-semibold text-[13.5px] text-slate-700">{p.name}</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">{p.project_code} · Ends: {p.end_date || 'N/A'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-[100px] flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-teal" style={{ width: `${p.progress}%` }} /></div>
                    <span className="text-[11px] font-mono-plex">{p.progress}%</span>
                  </div>
                  <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                  <Pill tone={riskTone(p.risk?.level)}>{p.risk?.level}</Pill>
                </div>
              </div>
            ))}
            {!pmWatchlist.length && <div key="pm-empty-wl" className="text-slate-400 text-sm py-8 text-center">All projects are healthy and on-track!</div>}
          </div>
        </div>

        <div key="pm-chart-box" className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="font-semibold text-[14.5px] mb-1">Project Status Breakdown</div>
            <div className="text-[12px] text-slate-500 mb-4">Overall project delivery stats</div>
          </div>
          <div className="h-[200px]">
            <Bar key="pm-status-bar" data={statusData} options={statusOptions} />
          </div>
        </div>
      </div>

      {/* PM Warnings & Quick Log */}
      <div className="grid md:grid-cols-3 gap-4">
        <div key="pm-warn-box" className="md:col-span-2 bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm h-full flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="font-semibold text-[14.5px] flex items-center gap-1.5"><ShieldAlert size={16} className="text-amber-500" /> Active Risk Warnings</div>
              <div className="text-[12px] text-slate-500">Live predictions computed by AI Risk Engine</div>
            </div>
            <button onClick={() => navigate('/risk')} className="text-[12px] font-semibold text-teal hover:underline">Mitigate Risk</button>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 notif-scroll">
            {notifications.filter(n => n.type === 'risk' || n.type === 'warn').map(n => (
              <div key={n.id} className="p-3 bg-slate-50 border-l-4 rounded-r-lg text-[13px]"
                style={{ borderLeftColor: n.type === 'risk' ? '#D5514C' : '#E2A33D' }}>
                <div className="font-semibold text-slate-700">{n.title}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">{n.message}</div>
              </div>
            ))}
            {!notifications.filter(n => n.type === 'risk' || n.type === 'warn').length && (
              <div key="pm-empty-notifs" className="text-slate-400 text-sm py-4">No risk predictions to display.</div>
            )}
          </div>
        </div>

        <div>
          <QuickLogHoursCard userEmployee={stats.userEmployee} onLogSave={onLogSave} authUser={authUser} />
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   REUSABLE QUICK LOG HOURS CARD
   ========================================== */
function QuickLogHoursCard({ userEmployee: initialEmployee, onLogSave, authUser }) {
  const [logForm, setLogForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    task: '',
    hours: 8
  });
  const [submitting, setSubmitting] = useState(false);

  // Resolve the employee record at submit time — never rely solely on the prop
  const resolveEmployee = async () => {
    if (initialEmployee) return initialEmployee;
    if (!authUser?.id) return null;

    // 1. Try by profile_id
    const { data: byId } = await supabase
      .from('employees')
      .select('*')
      .eq('profile_id', authUser.id)
      .maybeSingle();
    if (byId) return byId;

    // 2. Try by email
    if (authUser.email) {
      const { data: byEmail } = await supabase
        .from('employees')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();
      if (byEmail) {
        // Link it while we're here
        await supabase.from('employees').update({ profile_id: authUser.id }).eq('id', byEmail.id);
        return byEmail;
      }
    }

    // 3. Auto-create as last resort
    const { count: empCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });
    const empCode = 'EMP-' + String((empCount || 0) + 1).padStart(3, '0');
    const payload = {
      emp_code: empCode,
      name: authUser.name || authUser.email,
      email: authUser.email,
      department: authUser.department || null,
      designation: authUser.designation || null,
      profile_id: authUser.id,
      workload: 'Low',
      productivity_score: 0,
      weekly_hours: 0,
      daily_hours: 0,
    };
    const { data: created, error: createErr } = await supabase
      .from('employees')
      .insert([payload])
      .select()
      .single();

    if (createErr) {
      // FK violation: profile row doesn't exist yet — retry without profile_id
      // AuthContext will upsert the profile on next load and link them
      if (createErr.code === '23503') {
        console.warn('[QuickLog] FK violation — creating employee without profile_id (will link on next login)');
        const { data: createdNoLink, error: err2 } = await supabase
          .from('employees')
          .insert([{ ...payload, profile_id: null }])
          .select()
          .single();
        if (!err2 && createdNoLink) return createdNoLink;
        console.error('[QuickLog] Fallback create also failed:', err2?.message);
        throw new Error('Database not fully set up. Please run fix_and_ensure_schema.sql in Supabase SQL Editor.');
      }
      console.error('[QuickLog] Auto-create employee failed:', createErr.message, createErr);
      throw new Error('Could not create your employee record: ' + createErr.message);
    }
    return created;
  };

  const handleQuickLog = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const emp = await resolveEmployee();
      if (!emp) {
        toast('Could not find or create your employee record. Check console for details.');
        return;
      }
      const { error } = await supabase
        .from('work_logs')
        .insert([{
          employee_id: emp.id,
          log_date: logForm.log_date,
          task: logForm.task || 'General work',
          hours: Number(logForm.hours)
        }]);

      if (error) throw error;
      toast('Hours logged successfully!');
      setLogForm({ log_date: new Date().toISOString().slice(0, 10), task: '', hours: 8 });
      onLogSave();
    } catch (err) {
      console.error('[QuickLog] Submit error:', err);
      toast(err.message || 'Error logging hours.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="font-semibold text-[14.5px] mb-1 flex items-center gap-1 text-teal"><Clock size={16} /> Quick Log Hours</div>
        <div className="text-[12px] text-slate-500 mb-4">Record your hours directly to the log</div>
      </div>
      <form onSubmit={handleQuickLog} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Date</label>
            <input type="date" required className="in" value={logForm.log_date} onChange={e => setLogForm({ ...logForm, log_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Hours</label>
            <input type="number" required min="1" max="24" className="in font-mono-plex" value={logForm.hours} onChange={e => setLogForm({ ...logForm, hours: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Task description</label>
          <input type="text" required placeholder="What did you work on?" className="in" value={logForm.task} onChange={e => setLogForm({ ...logForm, task: e.target.value })} />
        </div>
        <button type="submit" disabled={submitting} className="w-full py-2 bg-teal text-white rounded-lg text-xs font-semibold hover:bg-teal-light transition-all disabled:opacity-50">
          {submitting ? 'Logging...' : 'Submit Entry'}
        </button>
      </form>
    </div>
  );
}

/* ==========================================
   EMPLOYEE DASHBOARD VIEW
   ========================================== */
function EmployeeDashboardView({ stats, notifications, navigate, onLogSave, authUser }) {
  const workloadLabel = stats.userEmployee?.workload || 'Low';
  const weeklyHours = stats.userEmployee?.weekly_hours || 0;
  const prodScore = stats.userEmployee?.productivity_score || 0;

  const handleCompleteProject = async (p, e) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('projects').update({ status: 'Completed', progress: 100 }).eq('id', p.id);
      if (error) throw error;
      toast(`Project "${p.name}" marked as Completed!`);
      onLogSave();
    } catch (err) {
      toast(err.message || 'Error completing project.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Employee Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard label="My Assigned Projects" value={stats.userProjects.length} accent="#0F6E7C" onClick={() => navigate('/projects')} />
        <StatCard label="My Logged Hours (Wk)" value={`${weeklyHours}h`} accent="#3E6FD9" onClick={() => navigate('/outcomes')} />
        <StatCard label="My Productivity Score" value={`${prodScore}%`} accent="#2E9E5B" onClick={() => navigate('/profile')} />
        <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">My Workload Status</div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-800">{workloadLabel}</span>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <Pill tone={riskTone(workloadLabel === 'Overloaded' ? 'High' : workloadLabel === 'High' ? 'Medium' : 'Low')}>{workloadLabel}</Pill>
          </div>
        </div>
      </div>

      {/* Main Employee panels */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Assigned Projects */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <div className="font-semibold text-[14.5px]">My Active Assignments</div>
            <button onClick={() => navigate('/projects')} className="text-xs text-teal font-semibold hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="text-[12px] text-slate-500 mb-4 border-b pb-2">Projects you are assigned to. You can mark completed deliverables below.</div>
          <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 notif-scroll">
            {stats.userProjects.map(p => (
              <div key={p.id} className="p-3 border border-slate-100 rounded-xl hover:border-slate-200 transition-all bg-slate-50/20">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-[13px] text-slate-700">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.project_code} · {p.start_date} → {p.end_date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                    {p.status !== 'Completed' ? (
                      <button
                        onClick={(e) => handleCompleteProject(p, e)}
                        title="Mark as Completed"
                        className="px-2 py-0.5 rounded bg-teal hover:bg-teal-light text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-sm"
                      >
                        <CheckCircle2 size={12} /> Complete
                      </button>
                    ) : (
                      <span className="text-emerald-600 text-[11px] font-semibold flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <Check size={11} strokeWidth={2.5} /> Done
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-teal" style={{ width: `${p.progress}%` }} /></div>
                  <span className="text-[11px] font-mono-plex">{p.progress}%</span>
                </div>
              </div>
            ))}
            {!stats.userProjects.length && (
              <div key="emp-empty-projs" className="text-slate-400 text-sm py-12 text-center">You are not assigned to any projects at this time.</div>
            )}
          </div>
        </div>

        {/* Quick Log Form */}
        <div>
          <QuickLogHoursCard userEmployee={stats.userEmployee} onLogSave={onLogSave} authUser={authUser} />
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-sm">
        <div className="font-semibold text-[14.5px] mb-3">Recent Notifications</div>
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="p-3 bg-slate-50 border-l-4 rounded-r-lg text-[13px]"
              style={{ borderLeftColor: n.type === 'risk' ? '#D5514C' : n.type === 'warn' ? '#E2A33D' : '#0F6E7C' }}>
              <div className="font-semibold text-slate-700">{n.title}</div>
              <div className="text-[12px] text-slate-500 mt-0.5">{n.message}</div>
            </div>
          ))}
          {!notifications.length && <div key="emp-empty-notifs" className="text-slate-400 text-sm py-4">No notifications yet.</div>}
        </div>
      </div>
      <style>{`.in{width:100%;padding:.4rem .5rem;border-radius:.375rem;font-size:.8rem;border:1px solid #E3E7EE;}`}</style>
    </div>
  );
}
