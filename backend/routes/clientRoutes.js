// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('Admin', 'Project Manager'), ctrl.create);
router.put('/:id', authorize('Admin', 'Project Manager'), ctrl.update);
router.delete('/:id', authorize('Admin', 'Project Manager'), ctrl.remove);

module.exports = router;
