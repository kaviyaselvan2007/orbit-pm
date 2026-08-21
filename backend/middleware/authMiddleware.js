// middleware/authMiddleware.js
require('dotenv').config();
const jwt = require('jsonwebtoken');

// Verifies the Bearer token sent in the Authorization header and attaches
// the decoded user payload to req.user.
function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token provided.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized — invalid or expired token.' });
  }
}

// Restricts a route to one or more roles, e.g. authorize('Admin', 'Project Manager')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — insufficient permissions.' });
    }
    next();
  };
}

module.exports = { protect, authorize };
