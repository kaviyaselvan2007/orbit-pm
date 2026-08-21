// controllers/reportController.js
const { pool } = require('../config/db');
const { computeRisk } = require('../utils/riskEngine');

async function buildReportData() {
  const projectsRes = await pool.query(
    `SELECT p.*, c.name AS client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id`
  );
  const employeesRes = await pool.query('SELECT * FROM employees');
  const clientsRes = await pool.query('SELECT * FROM clients');

  const employees = employeesRes.rows;
  const clients = clientsRes.rows;

  const withRisk = projectsRes.rows.map(p => {
    const names = (p.assigned_employees || '').split(',').map(s => s.trim()).filter(Boolean);
    const team = employees.filter(e => names.includes(e.name));
    return { ...p, risk: computeRisk(p, team) };
  });

  const delayed = withRisk.filter(p => p.status === 'Delayed');
  const highRisk = withRisk.filter(p => p.risk.level === 'High');
  const overloaded = employees.filter(e => e.workload === 'Overloaded');

  return { projects: withRisk, employees, clients, delayed, highRisk, overloaded };
}

// GET /api/reports/weekly  -> structured JSON
exports.weeklyJSON = async (req, res) => {
  const data = await buildReportData();
  res.json({
    generatedAt: new Date().toISOString(),
    summary: {
      totalProjects: data.projects.length,
      totalClients: data.clients.length,
      totalEmployees: data.employees.length,
      delayedCount: data.delayed.length,
      highRiskCount: data.highRisk.length,
      overloadedCount: data.overloaded.length,
    },
    delayed: data.delayed,
    highRisk: data.highRisk,
    overloaded: data.overloaded,
    clients: data.clients,
  });
};

// GET /api/reports/weekly/text -> printable plain-text report ("Save as PDF" client-side)
exports.weeklyText = async (req, res) => {
  const data = await buildReportData();
  const lines = [];
  lines.push('ORBITPM — WEEKLY PROJECT REPORT');
  lines.push('Generated: ' + new Date().toDateString());
  lines.push('='.repeat(50));
  lines.push('');
  lines.push('PORTFOLIO SUMMARY');
  lines.push(`Total Projects: ${data.projects.length} | Delayed: ${data.delayed.length} | High Risk: ${data.highRisk.length}`);
  lines.push(`Total Clients: ${data.clients.length} | Total Employees: ${data.employees.length}`);
  lines.push('');
  lines.push('DELAYED PROJECTS');
  lines.push(data.delayed.length ? data.delayed.map(p => `- ${p.name} (${p.client_name}) — ${p.progress}% complete`).join('\n') : '- None');
  lines.push('');
  lines.push('HIGH-RISK PROJECTS');
  lines.push(data.highRisk.length ? data.highRisk.map(p => `- ${p.name}: ${p.risk.reasons.join('; ')}`).join('\n') : '- None');
  lines.push('');
  lines.push('WORKLOAD ANALYSIS');
  lines.push(data.overloaded.length ? 'Overloaded: ' + data.overloaded.map(e => `${e.name} (${e.weekly_hours}h/wk)`).join(', ') : 'No employees currently overloaded.');
  lines.push('');
  lines.push('CLIENT STATISTICS');
  data.clients.forEach(c => lines.push(`- ${c.name}: ${c.active_projects} active, ${c.completed_projects} completed, risk ${c.risk_level}`));

  res.type('text/plain').send(lines.join('\n'));
};

// GET /api/reports/weekly/csv -> downloadable Excel-compatible CSV
exports.weeklyCSV = async (req, res) => {
  const data = await buildReportData();
  let csv = 'Project Code,Name,Client,Status,Priority,Progress,Risk Level,Start,End\n';
  data.projects.forEach(p => {
    csv += [p.project_code, p.name, p.client_name, p.status, p.priority, p.progress + '%', p.risk.level, p.start_date, p.end_date].join(',') + '\n';
  });
  res.header('Content-Type', 'text/csv');
  res.attachment('orbitpm_weekly_report.csv');
  res.send(csv);
};
