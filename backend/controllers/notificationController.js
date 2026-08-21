// controllers/notificationController.js
const { pool } = require('../config/db');

exports.getAll = async (req, res) => {
  const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
  res.json({ notifications: result.rows });
};

exports.markRead = async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
  res.json({ message: 'Notification marked as read.' });
};

exports.create = async (req, res) => {
  const { type, title, message } = req.body;
  const result = await pool.query(
    'INSERT INTO notifications (type, title, message) VALUES ($1, $2, $3) RETURNING id',
    [type || 'update', title, message]
  );
  res.status(201).json({ message: 'Notification created.', id: result.rows[0].id });
};
