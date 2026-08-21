// routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/effort/summary', ctrl.effortSummary);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('Admin'), ctrl.create);
router.put('/:id', authorize('Admin', 'Project Manager'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.remove);

module.exports = router;
