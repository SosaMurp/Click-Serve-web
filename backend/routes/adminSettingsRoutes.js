const express = require('express');
const router = express.Router();
const adminSettingsController = require('../controllers/adminSettingsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Ruta pública de comprobación de estado de mantenimiento
router.get('/system/status', adminSettingsController.getSystemStatus);

// Aplicar autenticación JWT y permisos de Administrador a las rutas protegidas
router.use(authMiddleware, adminMiddleware);

// Configuración general y calibración
router.get('/settings', adminSettingsController.getSettings);
router.put('/settings', adminSettingsController.updateSettings);
router.put('/settings/ai', adminSettingsController.updateAiSensitivity);

// Mantenimiento y suspensión
router.post('/system/maintenance', adminSettingsController.toggleMaintenanceMode);

// Exportación de reportes
router.post('/reports/export', adminSettingsController.exportReport);

module.exports = router;

