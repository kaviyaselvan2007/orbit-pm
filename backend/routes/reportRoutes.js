// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('Admin', 'Project Manager'));
router.get('/weekly', ctrl.weeklyJSON);
router.get('/weekly/text', ctrl.weeklyText);
router.get('/weekly/csv', ctrl.weeklyCSV);

module.exports = router;
