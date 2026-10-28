// routes/serviciosRoutes.js
const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // verifica JWT
const ctrl           = require('../controllers/serviciosController');

// POST   /api/servicios               — Crear servicio (con ubicación)
// GET    /api/servicios               — Listar servicios
// GET    /api/servicios/:id           — Detalle de un servicio (buscador del panel)
// PATCH  /api/servicios/:id/location  — Actualizar solo la ubicación
router.post  ('/',              authMiddleware, ctrl.createServicio);
router.get   ('/',              authMiddleware, ctrl.getServicios);
router.get   ('/:id',           authMiddleware, ctrl.getServicioById);
router.patch ('/:id/location',  authMiddleware, ctrl.updateServicioLocation);

// ── NUEVA RUTA: Actualización de estado y disparo de alertas ──
router.patch ('/:id/status',    authMiddleware, ctrl.updateServicioStatus);

module.exports = router;
