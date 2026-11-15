const express = require('express');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const realtime = require('../lib/realtime');

// Pagos en custodia para el panel: lo retenido, lo liberado y los reembolsos por hacer.
// La devolución a la tarjeta se ejecuta en la pasarela (Conekta); aquí se asienta con su referencia.

const router = express.Router();
const db = () => getPool();
const adminOnly = [auth, requireRole(ROL.ADMIN)];
const ESTADOS = ['RETENIDO', 'LIBERADO', 'REEMBOLSO_PENDIENTE', 'REEMBOLSADO'];

router.get('/api/admin/custodias', ...adminOnly, async (req, res) => {
  const estado = String(req.query.estado || 'REEMBOLSO_PENDIENTE').toUpperCase();
  if (!ESTADOS.includes(estado)) return fail(res, 400, 'VALIDATION_ERROR', 'Estado de custodia no válido.', { field: 'estado' });
  const { rows } = await db().query(
    `SELECT k.id_custodia, k.id_solicitud, s.folio, k.monto, k.modo, k.referencia, k.estado, k.referencia_reembolso,
            k.fecha_cobro, k.fecha_cierre, c.id_usuario AS id_cliente, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
     FROM custodias k
     JOIN solicitudes_servicio s ON s.id_solicitud = k.id_solicitud
     JOIN usuarios c ON c.id_usuario = k.id_cliente
     WHERE k.estado = $1
     ORDER BY k.fecha_cobro DESC LIMIT 200`,
    [estado]
  );
  res.json({ custodias: rows });
});

router.patch('/api/admin/custodias/:id/reembolsada', ...adminOnly, async (req, res) => {
  const referencia = sanitizeText(req.body?.referencia, 80);
  if (!referencia) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe la referencia del reembolso en la pasarela.', { field: 'referencia' });
  const custodia = await withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE custodias SET estado = 'REEMBOLSADO', referencia_reembolso = $2, fecha_cierre = NOW()
       WHERE id_custodia = $1 AND estado = 'REEMBOLSO_PENDIENTE'
       RETURNING id_custodia, id_solicitud, id_cliente, monto`,
      [req.params.id, referencia]
    );
    if (!rows[0]) throw new HttpError(409, 'INVALID_STATE', 'La custodia no está pendiente de reembolso.');
    // Si la orden ya no tiene otra custodia retenida, deja de marcarse con reembolso pendiente.
    await tx.query(
      `UPDATE solicitudes_servicio SET estado_pago = CASE WHEN estado = 'CANCELADA' THEN 'NO_APLICA' ELSE 'PENDIENTE' END
       WHERE id_solicitud = $1 AND estado_pago = 'REEMBOLSO_PENDIENTE'
         AND NOT EXISTS (SELECT 1 FROM custodias WHERE id_solicitud = $1 AND estado = 'REEMBOLSO_PENDIENTE')`,
      [rows[0].id_solicitud]
    );
    return rows[0];
  });
  audit(req, 'CUSTODIA_REEMBOLSADA', 'custodia', custodia.id_custodia, { referencia, monto: custodia.monto });
  realtime.emitToUser(custodia.id_cliente, 'solicitud.actualizada', {
    id_solicitud: Number(custodia.id_solicitud),
    aviso: `Te devolvimos $${Number(custodia.monto).toFixed(2)} que tenías en custodia.`,
  });
  res.json({ mensaje: 'Reembolso registrado.', custodia });
});

module.exports = router;
