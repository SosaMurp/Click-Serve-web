const express = require('express');
const router = express.Router();
const adminFinanceController = require('../controllers/adminFinanceController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Aplicar autenticación JWT y permisos de Administrador a todas las rutas
router.use(authMiddleware, adminMiddleware);

// Rutas de solicitudes de retiro y tesorería
router.get('/withdrawals', adminFinanceController.getWithdrawals);
router.post('/withdrawals/:id/approve', adminFinanceController.approveWithdrawal);
router.post('/withdrawals/:id/reject', adminFinanceController.rejectWithdrawal);
router.get('/withdrawals/:id/receipt', adminFinanceController.getWithdrawalReceipt);

// Rutas de liquidación de disputas y sanciones
router.get('/disputes', adminFinanceController.getDisputes);
router.post('/disputes/:id/settle', adminFinanceController.settleDispute);
router.get('/disputes/:id/export-pdf', adminFinanceController.exportDisputePdf);

module.exports = router;

