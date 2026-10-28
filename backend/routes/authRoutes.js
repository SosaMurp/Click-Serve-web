const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { loginLimiter, otpLimiter, recoveryLimiter } = require('../middleware/rateLimiter');

// ── Rutas públicas con protección contra fuerza bruta y enumeración ──
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/login-admin', loginLimiter, authController.loginAdmin);
router.post('/verify-login-admin', otpLimiter, authController.verifyLoginAdmin);
router.post('/verify-token', otpLimiter, authController.verifyToken);
router.post('/resend-code', recoveryLimiter, authController.resendCode);
router.post('/request-recovery', recoveryLimiter, authController.requestRecovery);
router.post('/verify-recovery', otpLimiter, authController.verifyRecovery);
router.post('/reset-password', otpLimiter, authController.resetPassword);

// ── Rutas protegidas por JWT ──
router.post('/update-password', authMiddleware, authController.updatePassword);
router.get('/auth/sessions', authMiddleware, authController.getSessions);
router.delete('/auth/sessions/:sessionId', authMiddleware, authController.revokeSession);
router.delete('/auth/sessions', authMiddleware, authController.revokeAllSessions);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
