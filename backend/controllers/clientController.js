// controllers/clientController.js
const { pool } = require('../config/db');

exports.getAll = async (req, res) => {
  const result = await pool.query('SELECT * FROM clients ORDER BY id ASC');
  res.json({ clients: result.rows });
};

exports.getOne = async (req, res) => {
  const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ message: 'Client not found.' });
  res.json({ client: result.rows[0] });
};

exports.create = async (req, res) => {
  const { name, company, contact_person, email, phone, project_count, active_projects, completed_projects, risk_level } = req.body;
  if (!name) return res.status(400).json({ message: 'Client name is required.' });

  const countRes = await pool.query('SELECT COUNT(*) AS c FROM clients');
  const client_code = 'CLI-' + String(parseInt(countRes.rows[0].c, 10) + 1).padStart(3, '0');

  const result = await pool.query(
    `INSERT INTO clients (client_code,name,company,contact_person,email,phone,project_count,active_projects,completed_projects,risk_level)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [client_code, name, company || '', contact_person || '', email || '', phone || '',
     project_count || 0, active_projects || 0, completed_projects || 0, risk_level || 'Low']
  );
  res.status(201).json({ message: 'Client created.', id: result.rows[0].id, client_code });
};

exports.update = async (req, res) => {
  const fields = ['name', 'company', 'contact_person', 'email', 'phone', 'project_count', 'active_projects', 'completed_projects', 'risk_level'];
  const updates = [], values = [];
  let i = 1;
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  });
  if (!updates.length) return res.status(400).json({ message: 'No fields to update.' });
  values.push(req.params.id);
  await pool.query(`UPDATE clients SET ${updates.join(', ')} WHERE id = $${i}`, values);
  res.json({ message: 'Client updated.' });
};

exports.remove = async (req, res) => {
  await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
  res.json({ message: 'Client deleted.' });
};
