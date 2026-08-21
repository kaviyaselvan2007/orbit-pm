// controllers/employeeController.js
const { pool } = require('../config/db');

exports.getAll = async (req, res) => {
  const result = await pool.query('SELECT * FROM employees ORDER BY id ASC');
  res.json({ employees: result.rows });
};

exports.getOne = async (req, res) => {
  const result = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ message: 'Employee not found.' });
  res.json({ employee: result.rows[0] });
};

exports.create = async (req, res) => {
  const { name, email, phone, department, designation, assigned_projects, daily_hours, weekly_hours, productivity_score, workload } = req.body;
  if (!name) return res.status(400).json({ message: 'Employee name is required.' });

  const countRes = await pool.query('SELECT COUNT(*) AS c FROM employees');
  const emp_code = 'EMP-' + String(parseInt(countRes.rows[0].c, 10) + 1).padStart(3, '0');

  const result = await pool.query(
    `INSERT INTO employees (emp_code,name,email,phone,department,designation,assigned_projects,daily_hours,weekly_hours,productivity_score,workload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [emp_code, name, email || '', phone || '', department || '', designation || '', assigned_projects || '',
     daily_hours || 0, weekly_hours || 0, productivity_score || 0, workload || 'Low']
  );
  res.status(201).json({ message: 'Employee created.', id: result.rows[0].id, emp_code });
};

exports.update = async (req, res) => {
  const fields = ['name', 'email', 'phone', 'department', 'designation', 'assigned_projects', 'daily_hours', 'weekly_hours', 'productivity_score', 'workload'];
  const updates = [], values = [];
  let i = 1;
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  });
  if (!updates.length) return res.status(400).json({ message: 'No fields to update.' });
  values.push(req.params.id);
  await pool.query(`UPDATE employees SET ${updates.join(', ')} WHERE id = $${i}`, values);
  res.json({ message: 'Employee updated.' });
};

exports.remove = async (req, res) => {
  await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
  res.json({ message: 'Employee deleted.' });
};

// GET /api/employees/effort/summary — overloaded / underutilized breakdown
exports.effortSummary = async (req, res) => {
  const result = await pool.query('SELECT * FROM employees');
  const rows = result.rows;
  const overloaded = rows.filter(e => e.workload === 'Overloaded' || Number(e.weekly_hours) > 40);
  const underutilized = rows.filter(e => e.workload === 'Low' || Number(e.weekly_hours) < 18);
  res.json({ overloaded, underutilized });
};
