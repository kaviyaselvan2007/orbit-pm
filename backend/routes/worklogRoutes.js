// routes/worklogRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/worklogController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.remove);

module.exports = router;
