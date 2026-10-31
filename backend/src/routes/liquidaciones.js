const express = require('express');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { getConfig } = require('../services/config');
const S = require('../services/solicitudes');

// Liquidación de conflictos (RF-82, RF-83): el administrador define cuánto se devuelve al cliente y la multa
// operativa al técnico; el sistema registra el movimiento contable y actualiza la billetera del técnico.
// Una incidencia se liquida una sola vez. El reembolso se asienta sobre el cobro original (pagos.monto_reembolsado);
// si el cobro fue real, la devolución a la tarjeta la hace tesorería desde la pasarela.
const router = express.Router();
const db = () => getPool();
const adminOnly = [auth, requireRole(ROL.ADMIN)];

const MULTA_MAXIMA = 10000;
const centavos = (n) => Math.round(n * 100) / 100;

function monto(value, field, max) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Escribe un monto válido para ${field} (de 0 a ${max}).`, { field });
  }
  return centavos(n);
}

// Datos que el panel necesita antes de liquidar: lo cobrado, lo ya devuelto y el saldo del técnico.
async function contexto(idIncidencia, q = db()) {
  const inc = (await q.query(
    `SELECT i.id_incidencia, i.folio, i.estado, i.monto_reembolso, i.multa, i.reembolso_a_cargo_tecnico, i.fecha_liquidacion,
            s.id_solicitud, s.folio AS folio_solicitud, s.id_usuario AS id_cliente, s.id_tecnico,
            p.id_pago, p.monto AS pagado, p.monto_reembolsado, p.estado AS estado_pago, p.modo AS modo_pago,
            b.id_billetera, b.saldo_actual AS saldo_tecnico,
            CONCAT(t.nombre, ' ', t.apellido) AS tecnico
     FROM incidencias i
     LEFT JOIN solicitudes_servicio s ON s.id_solicitud = i.id_solicitud
     LEFT JOIN pagos p ON p.id_solicitud = s.id_solicitud
     LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
     LEFT JOIN billetera_tecnico b ON b.id_usuario = s.id_tecnico
     WHERE i.id_incidencia = $1`,
    [idIncidencia]
  )).rows[0];
  if (!inc) throw new HttpError(404, 'NOT_FOUND', 'Incidencia no encontrada.');
  return inc;
}

router.get('/api/admin/incidencias/:id/liquidacion', ...adminOnly, async (req, res) => {
  const c = await contexto(req.params.id);
  const cfg = await getConfig();
  const pagado = c.id_pago && c.estado_pago === 'PAGADO' ? Number(c.pagado) : 0;
  res.json({
    liquidacion: {
      liquidada: !!c.fecha_liquidacion,
      fecha_liquidacion: c.fecha_liquidacion,
      monto_reembolso: c.monto_reembolso == null ? null : Number(c.monto_reembolso),
      multa: c.multa == null ? null : Number(c.multa),
      reembolso_a_cargo_tecnico: c.reembolso_a_cargo_tecnico,
      pagado,
      reembolsado: Number(c.monto_reembolsado || 0),
      reembolsable: centavos(Math.max(0, pagado - Number(c.monto_reembolsado || 0))),
      modo_pago: c.modo_pago,
      id_tecnico: c.id_tecnico,
      tecnico: c.id_tecnico ? c.tecnico : null,
      saldo_tecnico: c.id_tecnico ? Number(c.saldo_tecnico || 0) : null,
      multa_sugerida: Number(cfg.multa_operativa),
      multa_maxima: MULTA_MAXIMA,
    },
  });
});

router.post('/api/admin/incidencias/:id/liquidar', ...adminOnly, async (req, res) => {
  const devolucion = monto(req.body?.devolucion, 'la devolución', 1000000);
  const multa = monto(req.body?.multa, 'la multa', MULTA_MAXIMA);
  const aCargoTecnico = req.body?.descontar_devolucion === true;
  const notas = sanitizeText(req.body?.notas, 500) || null;
  if (devolucion + multa <= 0) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Define un monto a devolver al cliente o una multa al técnico.', { field: 'devolucion' });
  }

  const out = await withTransaction(async (tx) => {
    const lock = (await tx.query('SELECT id_incidencia, fecha_liquidacion, id_solicitud FROM incidencias WHERE id_incidencia = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lock) throw new HttpError(404, 'NOT_FOUND', 'Incidencia no encontrada.');
    if (lock.fecha_liquidacion) throw new HttpError(409, 'ALREADY_SETTLED', 'Este caso ya fue liquidado.');
    if (!lock.id_solicitud) throw new HttpError(409, 'INVALID_STATE', 'La incidencia no tiene una orden asociada.');
    await tx.query('SELECT 1 FROM pagos WHERE id_solicitud = $1 FOR UPDATE', [lock.id_solicitud]);
    const c = await contexto(req.params.id, tx);

    const pagado = c.id_pago && c.estado_pago === 'PAGADO' ? Number(c.pagado) : 0;
    const reembolsable = centavos(Math.max(0, pagado - Number(c.monto_reembolsado || 0)));
    if (devolucion > 0 && !pagado) throw new HttpError(409, 'NO_PAYMENT', 'La orden no tiene un cobro registrado: no hay nada que devolver al cliente.');
    if (devolucion > reembolsable) {
      throw new HttpError(409, 'REFUND_EXCEEDS_PAYMENT', `Solo se pueden devolver $${reembolsable.toFixed(2)}: es lo que queda del cobro de $${pagado.toFixed(2)}.`, { field: 'devolucion' });
    }
    const cargo = centavos(multa + (aCargoTecnico ? devolucion : 0));
    if (cargo > 0 && !c.id_tecnico) throw new HttpError(409, 'NO_TECHNICIAN', 'La orden no tiene técnico: no hay billetera a la que aplicar el cargo.');

    let saldo = null;
    const movimientos = [];
    if (cargo > 0) {
      const wallet = (await tx.query(
        `INSERT INTO billetera_tecnico (id_usuario, saldo_actual) VALUES ($1, 0)
         ON CONFLICT (id_usuario) DO UPDATE SET id_usuario = EXCLUDED.id_usuario RETURNING id_billetera`,
        [c.id_tecnico]
      )).rows[0];
      await tx.query('SELECT 1 FROM billetera_tecnico WHERE id_billetera = $1 FOR UPDATE', [wallet.id_billetera]);
      const desglose = JSON.stringify({ incidencia: c.folio, notas });
      const asienta = async (concepto, importe) => {
        const t = (await tx.query(
          `INSERT INTO transacciones (id_billetera, monto, tipo, estado, folio, concepto, id_solicitud, desglose)
           VALUES ($1, $2::numeric, 'AJUSTE', 'COMPLETADO', $3, $4, $5, $6) RETURNING id_transaccion, folio, concepto, monto`,
          [wallet.id_billetera, importe, S.folio('TRX'), concepto, c.id_solicitud, desglose]
        )).rows[0];
        movimientos.push(t);
      };
      if (multa > 0) await asienta('MULTA', multa);
      if (aCargoTecnico && devolucion > 0) await asienta('REEMBOLSO', devolucion);
      saldo = Number((await tx.query(
        'UPDATE billetera_tecnico SET saldo_actual = saldo_actual - $1::numeric, fecha_actualizacion = NOW() WHERE id_billetera = $2 RETURNING saldo_actual',
        [cargo, wallet.id_billetera]
      )).rows[0].saldo_actual);
    }

    if (devolucion > 0) {
      await tx.query(
        `UPDATE pagos SET monto_reembolsado = monto_reembolsado + $1::numeric,
           estado = CASE WHEN monto_reembolsado + $1::numeric >= monto THEN 'REEMBOLSADO' ELSE estado END
         WHERE id_pago = $2`,
        [devolucion, c.id_pago]
      );
    }
    await tx.query(
      `UPDATE incidencias SET monto_reembolso = $1, multa = $2, reembolso_a_cargo_tecnico = $3, fecha_liquidacion = NOW(),
         id_admin = $4, notas_admin = COALESCE($5, notas_admin)
       WHERE id_incidencia = $6`,
      [devolucion, multa, aCargoTecnico, req.user.id_usuario, notas, c.id_incidencia]
    );
    return { c, cargo, saldo, movimientos };
  });

  audit(req, 'CONFLICTO_LIQUIDADO', 'incidencia', out.c.id_incidencia, {
    devolucion, multa, descontar_devolucion: aCargoTecnico, cargo_tecnico: out.cargo, modo_pago: out.c.modo_pago,
  });
  if (devolucion > 0) {
    sendPush(out.c.id_cliente, 'Reembolso registrado', `Registramos $${devolucion.toFixed(2)} a tu favor por el reporte ${out.c.folio}.`, { id_solicitud: Number(out.c.id_solicitud) });
  }
  if (out.cargo > 0) {
    sendPush(out.c.id_tecnico, 'Cargo por incidencia', `Se aplicó un cargo de $${out.cargo.toFixed(2)} a tu billetera por el reporte ${out.c.folio}.`, { id_solicitud: Number(out.c.id_solicitud) });
    realtime.emitToUser(out.c.id_tecnico, 'billetera.actualizada', { id_solicitud: Number(out.c.id_solicitud) });
  }
  res.json({
    mensaje: 'Caso liquidado.',
    liquidacion: {
      monto_reembolso: devolucion, multa, reembolso_a_cargo_tecnico: aCargoTecnico, cargo_tecnico: out.cargo,
      saldo_tecnico: out.saldo, saldo_negativo: out.saldo != null && out.saldo < 0, movimientos: out.movimientos,
    },
  });
});

module.exports = router;
