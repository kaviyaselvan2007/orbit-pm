// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup', ctrl.signup);
router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', protect, ctrl.me);
router.put('/me', protect, ctrl.updateMe);
router.put('/change-password', protect, ctrl.changePassword);
router.post('/send-2fa', ctrl.send2FA);
router.post('/verify-2fa', ctrl.verify2FA);
router.post('/send-login-alert', ctrl.sendLoginAlert);

module.exports = router;
