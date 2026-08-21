// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id/read', ctrl.markRead);

module.exports = router;
