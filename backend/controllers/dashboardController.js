// controllers/dashboardController.js
const { pool } = require('../config/db');
const { computeRisk } = require('../utils/riskEngine');

exports.getStats = async (req, res) => {
  const projectsRes = await pool.query('SELECT * FROM projects');
  const clientsRes = await pool.query('SELECT COUNT(*) AS c FROM clients');
  const employeesRes = await pool.query('SELECT * FROM employees');

  const projects = projectsRes.rows;
  const employees = employeesRes.rows;

  const withRisk = projects.map(p => {
    const names = (p.assigned_employees || '').split(',').map(s => s.trim()).filter(Boolean);
    const team = employees.filter(e => names.includes(e.name));
    return { ...p, risk: computeRisk(p, team) };
  });

  const statusCounts = { Active: 0, Completed: 0, Delayed: 0, 'On Hold': 0 };
  const riskCounts = { Low: 0, Medium: 0, High: 0 };
  withRisk.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    riskCounts[p.risk.level]++;
  });

  res.json({
    totalProjects: projects.length,
    activeProjects: statusCounts.Active,
    completedProjects: statusCounts.Completed,
    delayedProjects: statusCounts.Delayed,
    highRiskProjects: riskCounts.High,
    totalClients: parseInt(clientsRes.rows[0].c, 10),
    totalEmployees: employees.length,
    statusCounts,
    riskCounts,
  });
};
