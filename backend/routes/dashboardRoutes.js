// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, ctrl.getStats);

module.exports = router;
