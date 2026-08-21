// controllers/worklogController.js
const { pool } = require('../config/db');

exports.getAll = async (req, res) => {
  const result = await pool.query(
    `SELECT w.*, e.name AS employee_name FROM work_logs w
     JOIN employees e ON e.id = w.employee_id ORDER BY w.log_date DESC, w.id DESC`
  );
  res.json({ logs: result.rows });
};

exports.create = async (req, res) => {
  const { employee_id, log_date, task, hours } = req.body;
  if (!employee_id || !log_date) return res.status(400).json({ message: 'employee_id and log_date are required.' });

  const result = await pool.query(
    'INSERT INTO work_logs (employee_id, log_date, task, hours) VALUES ($1, $2, $3, $4) RETURNING id',
    [employee_id, log_date, task || 'General work', hours || 0]
  );

  // Recalculate this employee's weekly hours from the last 7 days of log entries.
  const sumRes = await pool.query(
    `SELECT COALESCE(SUM(hours),0) AS total FROM work_logs
     WHERE employee_id = $1 AND log_date >= (CURRENT_DATE - INTERVAL '7 days')`,
    [employee_id]
  );
  const weekly = Number(sumRes.rows[0].total);
  let workload = 'Low';
  if (weekly > 40) workload = 'Overloaded';
  else if (weekly > 32) workload = 'High';
  else if (weekly > 18) workload = 'Medium';
  await pool.query('UPDATE employees SET weekly_hours = $1, workload = $2 WHERE id = $3', [weekly, workload, employee_id]);

  res.status(201).json({ message: 'Work log saved.', id: result.rows[0].id });
};

exports.remove = async (req, res) => {
  await pool.query('DELETE FROM work_logs WHERE id = $1', [req.params.id]);
  res.json({ message: 'Work log deleted.' });
};
