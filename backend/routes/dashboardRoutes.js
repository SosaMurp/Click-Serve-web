// routes/dashboardRoutes.js
const express = require('express');
const router  = express.Router();
const authMiddleware  = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const ctrl = require('../controllers/dashboardController');

// Todos los endpoints requieren JWT válido y rol de administrador
router.use(authMiddleware, adminMiddleware);

router.get('/stats',            ctrl.getStats);
router.get('/servicios-mes',    ctrl.getServiciosMes);
router.get('/recent-services',  ctrl.getRecentServices);
router.get('/actividad',        ctrl.getActividad);
router.get('/especialidades',   ctrl.getEspecialidades);

module.exports = router;
