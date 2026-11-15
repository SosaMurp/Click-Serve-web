const express = require('express');
const { getPool } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const sanciones = require('../services/sanciones');

// Escala progresiva de sanciones para el panel: historial de un usuario, sanción manual (cobros indebidos o
// agresiones que el sistema no detecta solo) y levantar una sanción tras revisarla.

const router = express.Router();
const db = () => getPool();
const adminOnly = [auth, requireRole(ROL.ADMIN)];

router.get('/api/admin/usuarios/:id/sanciones', ...adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const [usuario, lista, infracciones] = await Promise.all([
    db().query('SELECT id_usuario, nombre, apellido, suspendido_hasta, prioridad_baja_hasta, baneado FROM usuarios WHERE id_usuario = $1', [id]),
    db().query('SELECT * FROM sanciones WHERE id_usuario = $1 ORDER BY inicio DESC LIMIT 100', [id]),
    db().query('SELECT id_infraccion, tipo, id_solicitud, id_conversacion, detalle, nivel_resultante, fecha FROM infracciones WHERE id_usuario = $1 ORDER BY fecha DESC LIMIT 100', [id]),
  ]);
  if (!usuario.rows[0]) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');
  res.json({ usuario: usuario.rows[0], sanciones: lista.rows, infracciones: infracciones.rows });
});

router.post('/api/admin/usuarios/:id/sanciones', ...adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const nivel = Number(req.body?.nivel);
  const motivo = sanitizeText(req.body?.motivo, 500);
  if (id === req.user.id_usuario) return fail(res, 409, 'SELF_ACTION', 'No puedes sancionar tu propia cuenta.');
  if (![1, 2, 3, 4].includes(nivel)) return fail(res, 400, 'VALIDATION_ERROR', 'El nivel debe ser 1, 2, 3 o 4.', { field: 'nivel' });
  if (motivo.length < 5) return fail(res, 400, 'VALIDATION_ERROR', 'Describe el motivo de la sanción.', { field: 'motivo' });
  const sancion = await sanciones.sancionarComoAdmin({ idUsuario: id, nivel, motivo, idAdmin: req.user.id_usuario });
  audit(req, 'SANCION_APLICADA', 'usuario', id, { nivel, motivo });
  res.status(201).json({ mensaje: `Sanción de nivel ${nivel} aplicada.`, sancion });
});

router.post('/api/admin/sanciones/:id/levantar', ...adminOnly, async (req, res) => {
  const s = await sanciones.levantarSancion(Number(req.params.id));
  audit(req, 'SANCION_LEVANTADA', 'sancion', req.params.id, { id_usuario: s.id_usuario, nivel: s.nivel });
  res.json({ mensaje: 'Sanción levantada.' });
});

module.exports = router;
