// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { sendEmail } = require('../utils/mailer');

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitize(user) {
  const { password_hash, reset_token, reset_expires, ...safe } = user;
  return safe;
}

// POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const countRes = await pool.query('SELECT COUNT(*) AS c FROM users');
    const empCode = 'EMP-' + String(parseInt(countRes.rows[0].c, 10) + 1).padStart(3, '0');

    const insertRes = await pool.query(
      `INSERT INTO users (emp_code, name, email, password_hash, role, join_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING id`,
      [empCode, name, email, hash, role || 'Employee']
    );
    const rows = await pool.query('SELECT * FROM users WHERE id = $1', [insertRes.rows[0].id]);
    const user = rows.rows[0];
    res.status(201).json({ message: 'Account created successfully.', user: sanitize(user), token: signToken(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating account.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ message: 'Invalid email or password.' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid email or password.' });

    res.json({ message: 'Login successful.', user: sanitize(user), token: signToken(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await pool.query('UPDATE users SET reset_token = $1, reset_expires = $2 WHERE email = $3', [token, expires, email]);

    res.json({ message: 'Reset token generated.', resetToken: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating reset token.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()', [token]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Reset link is invalid or has expired.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [hash, result.rows[0].id]
    );
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows.length) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: sanitize(result.rows[0]) });
};

// PUT /api/auth/me
exports.updateMe = async (req, res) => {
  const { name, phone, department, designation, join_date, avatar_url } = req.body;
  await pool.query(
    `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
     department = COALESCE($3, department), designation = COALESCE($4, designation),
     join_date = COALESCE($5, join_date), avatar_url = COALESCE($6, avatar_url) WHERE id = $7`,
    [name, phone, department, designation, join_date || null, avatar_url, req.user.id]
  );
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  res.json({ message: 'Profile updated.', user: sanitize(result.rows[0]) });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ message: 'Password updated successfully.' });
};

// POST /api/auth/send-2fa
exports.send2FA = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    
    const userRes = await pool.query('SELECT id, email, name FROM profiles WHERE email = $1', [email]);
    if (!userRes.rows.length) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    const user = userRes.rows[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await pool.query('UPDATE profiles SET two_factor_code = $1, two_factor_expires = $2 WHERE email = $3', [code, expires, email]);

    await sendEmail({
      to: email,
      subject: 'Your ORBITPM Two-Factor Authentication Code',
      text: `Hello ${user.name},\n\nYour 2-step verification code is: ${code}\n\nThis code is valid for 5 minutes.\n\nBest regards,\nThe ORBITPM Team`,
      html: `<p>Hello ${user.name},</p><p>Your 2-step verification code is: <strong>${code}</strong></p><p>This code is valid for 5 minutes.</p><p>Best regards,<br>The ORBITPM Team</p>`
    });

    res.json({ message: '2FA code sent successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error sending 2FA code.' });
  }
};

// POST /api/auth/verify-2fa
exports.verify2FA = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and code are required.' });

    const userRes = await pool.query('SELECT id, two_factor_code, two_factor_expires FROM profiles WHERE email = $1', [email]);
    if (!userRes.rows.length) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    const user = userRes.rows[0];

    if (!user.two_factor_code || user.two_factor_code !== code) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (new Date() > new Date(user.two_factor_expires)) {
      return res.status(400).json({ message: 'Verification code has expired.' });
    }

    // Clear the code on success
    await pool.query('UPDATE profiles SET two_factor_code = NULL, two_factor_expires = NULL WHERE email = $1', [email]);

    res.json({ message: 'Verification successful.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error verifying 2FA code.' });
  }
};

// POST /api/auth/send-login-alert
exports.sendLoginAlert = async (req, res) => {
  try {
    const { email, userAgent } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const userRes = await pool.query('SELECT id, email, name, login_alerts FROM profiles WHERE email = $1', [email]);
    if (!userRes.rows.length) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    const user = userRes.rows[0];

    if (user.login_alerts !== false) {
      await sendEmail({
        to: email,
        subject: 'ORBITPM Security Alert: New Sign-in Detected',
        text: `Hello ${user.name},\n\nWe detected a new login to your ORBITPM account.\n\nDate/Time: ${new Date().toUTCString()}\nDevice/Browser: ${userAgent || 'Unknown'}\n\nIf this was you, no action is needed. If you do not recognize this login, please reset your password immediately.\n\nBest regards,\nThe ORBITPM Team`,
        html: `<p>Hello ${user.name},</p><p>We detected a new login to your ORBITPM account.</p><ul><li><strong>Date/Time:</strong> ${new Date().toUTCString()}</li><li><strong>Device/Browser:</strong> ${userAgent || 'Unknown'}</li></ul><p>If this was you, no action is needed. If you do not recognize this login, please reset your password immediately.</p><p>Best regards,<br>The ORBITPM Team</p>`
      });
    }

    res.json({ message: 'Login alert sent (if enabled).' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error sending login alert.' });
  }
};
