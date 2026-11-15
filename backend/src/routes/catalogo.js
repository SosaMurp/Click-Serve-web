const express = require('express');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { audit } = require('../lib/audit');
const catalogo = require('../services/catalogo');

// Catálogo de servicios con precio base por servicio:
// - El técnico ve y fija sus precios por servicio (dentro del rango, un cambio por semana por servicio).
// - El administrador crea servicios y ajusta rangos y precios sugeridos desde el panel.
const router = express.Router();
const techOnly = [auth, requireRole(ROL.TECNICO)];
const adminOnly = [auth, requireRole(ROL.ADMIN)];

router.get('/api/servicios', auth, async (_req, res) => {
  res.json({ servicios: await catalogo.listar() });
});

router.get('/api/tecnico/precios', ...techOnly, async (req, res) => {
  res.json({ servicios: await catalogo.preciosDelTecnico(req.user.id_usuario), dias_entre_cambios: catalogo.DIAS_ENTRE_CAMBIOS });
});

router.patch('/api/tecnico/precios/:idServicio', ...techOnly, async (req, res) => {
  const out = await catalogo.fijarPrecio(req.user.id_usuario, req.params.idServicio, req.body?.precio);
  if (!out.sin_cambio) audit(req, 'PRECIO_SERVICIO_ACTUALIZADO', 'servicio', out.id_servicio, { precio: out.precio });
  res.json({
    mensaje: out.sin_cambio ? 'Tu precio no cambió.' : `Tu precio de "${out.nombre}" ahora es $${out.precio}.`,
    servicios: await catalogo.preciosDelTecnico(req.user.id_usuario),
  });
});

router.get('/api/admin/servicios', ...adminOnly, async (_req, res) => {
  res.json({ servicios: await catalogo.listar({ incluirInactivos: true }) });
});

router.post('/api/admin/servicios', ...adminOnly, async (req, res) => {
  const servicio = await catalogo.crear(req.body || {});
  audit(req, 'SERVICIO_CREADO', 'servicio', servicio.id_servicio, { categoria: servicio.categoria, nombre: servicio.nombre });
  res.status(201).json({ mensaje: 'Servicio agregado al catálogo.', servicio });
});

router.patch('/api/admin/servicios/:id', ...adminOnly, async (req, res) => {
  const servicio = await catalogo.editar(req.params.id, req.body || {});
  audit(req, 'SERVICIO_EDITADO', 'servicio', servicio.id_servicio, {
    precio_min: servicio.precio_min, precio_max: servicio.precio_max, precio_sugerido: servicio.precio_sugerido, activo: servicio.activo,
  });
  res.json({ mensaje: 'Servicio actualizado.', servicio });
});

module.exports = router;
