const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Aplicar verificación JWT y permisos de Administrador a todas las rutas
router.use(authMiddleware, adminMiddleware);

// Gestión y búsqueda de usuarios
router.get('/users', adminUserController.getUsers);
router.post('/users/search-advanced', adminUserController.searchAdvanced);
router.post('/co-admins', adminUserController.registerCoAdmin);
router.get('/users/:id/export', adminUserController.exportUserBackup);
router.delete('/users/:id', adminUserController.deleteUser);
router.post('/users/:id/suspend', adminUserController.suspendUser);
router.post('/users/:id/reactivate', adminUserController.reactivateUser);

// Auditoría y verificación de expedientes técnicos
router.get('/verifications', adminUserController.getVerifications);
router.get('/verifications/:id', adminUserController.getTechnicianDetail);
router.post('/verifications/:id/approve', adminUserController.approveTechnician);
router.post('/verifications/:id/reject', adminUserController.rejectTechnician);

module.exports = router;

