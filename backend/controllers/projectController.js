// controllers/projectController.js
const { pool } = require('../config/db');
const { computeRisk } = require('../utils/riskEngine');

async function attachRisk(project) {
  const names = (project.assigned_employees || '').split(',').map(s => s.trim()).filter(Boolean);
  let team = [];
  if (names.length) {
    const result = await pool.query('SELECT workload FROM employees WHERE name = ANY($1::text[])', [names]);
    team = result.rows;
  }
  const risk = computeRisk(project, team);
  return { ...project, risk };
}

// GET /api/projects
exports.getAll = async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, c.name AS client_name FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id ORDER BY p.id DESC`
  );
  const withRisk = await Promise.all(result.rows.map(attachRisk));
  res.json({ projects: withRisk });
};

// GET /api/projects/:id
exports.getOne = async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, c.name AS client_name FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = $1`, [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ message: 'Project not found.' });
  res.json({ project: await attachRisk(result.rows[0]) });
};

// POST /api/projects
exports.create = async (req, res) => {
  const { name, client_id, start_date, end_date, progress, priority, status, assigned_employees, remarks } = req.body;
  if (!name) return res.status(400).json({ message: 'Project name is required.' });

  const countRes = await pool.query('SELECT COUNT(*) AS c FROM projects');
  const project_code = 'PRJ-' + String(parseInt(countRes.rows[0].c, 10) + 1).padStart(3, '0');

  const result = await pool.query(
    `INSERT INTO projects (project_code,name,client_id,start_date,end_date,progress,priority,status,assigned_employees,remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [project_code, name, client_id || null, start_date || null, end_date || null, progress || 0,
     priority || 'Medium', status || 'Active', assigned_employees || '', remarks || '']
  );
  res.status(201).json({ message: 'Project created.', id: result.rows[0].id, project_code });
};

// PUT /api/projects/:id
exports.update = async (req, res) => {
  const fields = ['name', 'client_id', 'start_date', 'end_date', 'progress', 'priority', 'status', 'assigned_employees', 'remarks'];
  const updates = [], values = [];
  let i = 1;
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  });
  if (!updates.length) return res.status(400).json({ message: 'No fields to update.' });
  values.push(req.params.id);
  await pool.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${i}`, values);
  res.json({ message: 'Project updated.' });
};

// DELETE /api/projects/:id
exports.remove = async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  res.json({ message: 'Project deleted.' });
};
