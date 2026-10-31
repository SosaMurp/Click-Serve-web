const express = require('express');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const { signFileUrl } = require('../lib/files');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { getConfig, invalidateConfig } = require('../services/config');

// Rutas del panel web de administrador sobre los mismos datos que usa la app.
// Antes el panel leía tablas propias (expedientes_tecnicos, solicitudes_retiro) que la app nunca llenaba.
const router = express.Router();
const db = () => getPool();
const adminOnly = [auth, requireRole(ROL.ADMIN)];

// ───────────────────────── Revisión de técnicos (RF-28 a RF-41) ─────────────────────────
const FILTRO_TECNICOS = {
  pendientes: "u.identidad_verificada = false AND UPPER(COALESCE(u.estado_cuenta, '')) NOT IN ('RECHAZADO', 'SUSPENDIDO')",
  aprobados: "u.identidad_verificada = true AND UPPER(COALESCE(u.estado_cuenta, '')) IN ('ACTIVO', 'APROBADO')",
  rechazados: "UPPER(COALESCE(u.estado_cuenta, '')) = 'RECHAZADO'",
  suspendidos: "UPPER(COALESCE(u.estado_cuenta, '')) = 'SUSPENDIDO'",
  todos: 'true',
};

const METRICAS_SQL = `
  (SELECT ROUND(AVG(q.puntuacion_tecnico)::numeric, 1) FROM calificaciones_servicio q WHERE q.id_tecnico = u.id_usuario AND q.puntuacion_tecnico IS NOT NULL) AS calificacion,
  (SELECT COUNT(*)::int FROM solicitudes_servicio f WHERE f.id_tecnico = u.id_usuario AND f.estado = 'FINALIZADA') AS trabajos,
  (SELECT COUNT(*)::int FROM solicitudes_servicio f WHERE f.id_tecnico = u.id_usuario AND f.estado = 'CANCELADA') AS cancelados`;

router.get('/api/admin/tecnicos', ...adminOnly, async (req, res) => {
  const filtro = FILTRO_TECNICOS[String(req.query.estado || 'pendientes').toLowerCase()];
  if (!filtro) return fail(res, 400, 'VALIDATION_ERROR', 'Filtro de estado no válido.', { field: 'estado' });
  const { rows } = await db().query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.estado_cuenta, u.identidad_verificada,
            COALESCE(u.verificado_sep, false) AS verificado_sep, u.fecha_registro, u.fecha_revision, u.motivo_rechazo,
            (SELECT COUNT(*)::int FROM documentos_usuario d WHERE d.id_usuario = u.id_usuario) AS documentos,
            (SELECT COUNT(*)::int FROM documentos_usuario d WHERE d.id_usuario = u.id_usuario AND d.estado = 'EN_REVISION') AS documentos_pendientes,
            (SELECT array_agg(c.nombre ORDER BY c.orden) FROM especialidades_tecnico e JOIN categorias_servicio c ON c.codigo = e.categoria
              WHERE e.id_usuario = u.id_usuario) AS especialidades,
            ${METRICAS_SQL}
     FROM usuarios u
     WHERE u.id_rol = 2 AND u.anonimizado = false AND ${filtro}
     ORDER BY u.fecha_registro DESC
     LIMIT 500`
  );
  res.json({ tecnicos: rows });
});

// Expediente completo: datos, documentos con URL firmada de 5 min (RNF-26), especialidades y métricas.
router.get('/api/admin/usuarios/:id/expediente', ...adminOnly, async (req, res) => {
  const usuario = (await db().query(
    `SELECT u.id_usuario, u.id_rol, u.nombre, u.apellido, u.correo, u.telefono, u.fecha_nacimiento, u.estado_cuenta,
            u.identidad_verificada, COALESCE(u.verificado_sep, false) AS verificado_sep, u.disponible, u.bio,
            u.fecha_registro, u.fecha_revision, u.motivo_rechazo, u.foto_archivo,
            ${METRICAS_SQL}
     FROM usuarios u WHERE u.id_usuario = $1 AND u.anonimizado = false`,
    [req.params.id]
  )).rows[0];
  if (!usuario) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');

  const documentos = (await db().query(
    `SELECT id_documento, tipo, id_archivo, numero, descripcion, estado, fecha_creacion
     FROM documentos_usuario WHERE id_usuario = $1 ORDER BY fecha_creacion`,
    [usuario.id_usuario]
  )).rows.map(({ id_archivo, ...d }) => ({ ...d, url: signFileUrl(id_archivo) }));

  const especialidades = (await db().query(
    `SELECT e.id_especialidad, e.categoria, COALESCE(c.nombre, e.nombre) AS nombre, e.estado, e.activa
     FROM especialidades_tecnico e LEFT JOIN categorias_servicio c ON c.codigo = e.categoria
     WHERE e.id_usuario = $1 ORDER BY c.orden NULLS LAST`,
    [usuario.id_usuario]
  )).rows;

  const { foto_archivo, ...datos } = usuario;
  audit(req, 'EXPEDIENTE_CONSULTADO', 'usuario', usuario.id_usuario);
  res.json({ expediente: { ...datos, foto_url: signFileUrl(foto_archivo), documentos, especialidades } });
});

// RF-41: rechazo con motivo y, si hay sospecha de fraude, bloqueo inmediato (cierra todas sus sesiones).
router.patch('/api/admin/usuarios/:id/rechazar', ...adminOnly, async (req, res) => {
  const motivo = sanitizeText(req.body?.motivo, 500);
  if (!motivo) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe el motivo del rechazo.', { field: 'motivo' });
  const bloquear = req.body?.bloquear === true;
  const estado = bloquear ? 'SUSPENDIDO' : 'RECHAZADO';

  const usuario = await withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE usuarios SET identidad_verificada = false, estado_cuenta = $1, estado = $1, disponible = false,
              motivo_rechazo = $2, fecha_revision = NOW()
       WHERE id_usuario = $3 AND id_rol <> $4 AND anonimizado = false RETURNING id_usuario`,
      [estado, motivo, req.params.id, ROL.ADMIN]
    );
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado.');
    await tx.query("UPDATE documentos_usuario SET estado = 'RECHAZADO' WHERE id_usuario = $1 AND estado = 'EN_REVISION'", [req.params.id]);
    if (bloquear) {
      await tx.query("UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1 AND estado = 'activa'", [req.params.id]);
    }
    return rows[0];
  });

  audit(req, bloquear ? 'USUARIO_BLOQUEADO' : 'USUARIO_RECHAZADO', 'usuario', usuario.id_usuario, { motivo });
  if (bloquear) {
    realtime.revalidateSessions();
  } else {
    realtime.emitToUser(usuario.id_usuario, 'cuenta.rechazada', { aviso: `Tu solicitud no fue aprobada: ${motivo}` });
    sendPush(usuario.id_usuario, 'Revisión de tu cuenta', 'Tu solicitud no fue aprobada. Abre la app para ver el motivo.');
  }
  res.json({ mensaje: bloquear ? 'Solicitud rechazada y cuenta bloqueada.' : 'Solicitud rechazada.' });
});

// ───────────────────────── Retiros de técnicos (RF-77, RF-78, RF-79) ─────────────────────────
// La app descuenta el saldo al pedir el retiro (estado EN_PROCESO). Tesorería lo completa o lo rechaza;
// al rechazarlo, el monto regresa a la billetera en la misma transacción (RNF-22/24).
const ESTADOS_RETIRO = ['EN_PROCESO', 'COMPLETADO', 'RECHAZADO'];

router.get('/api/admin/retiros', ...adminOnly, async (req, res) => {
  const estado = String(req.query.estado || '').toUpperCase();
  if (estado && !ESTADOS_RETIRO.includes(estado)) return fail(res, 400, 'VALIDATION_ERROR', 'Estado no válido.', { field: 'estado' });
  const { rows } = await db().query(
    `SELECT t.id_transaccion, t.folio, t.monto, t.estado, t.fecha, t.fecha_procesado, t.motivo_rechazo,
            t.clabe_destino, t.banco_destino,
            u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono
     FROM transacciones t
     JOIN billetera_tecnico b ON b.id_billetera = t.id_billetera
     JOIN usuarios u ON u.id_usuario = b.id_usuario
     WHERE t.tipo = 'RETIRO' AND ($1::text = '' OR t.estado = $1)
     ORDER BY (t.estado = 'EN_PROCESO') DESC, t.fecha DESC
     LIMIT 500`,
    [estado]
  );
  res.json({ retiros: rows });
});

async function lockRetiro(tx, id) {
  const row = (await tx.query(
    `SELECT t.*, b.id_usuario FROM transacciones t JOIN billetera_tecnico b ON b.id_billetera = t.id_billetera
     WHERE t.id_transaccion = $1 AND t.tipo = 'RETIRO' FOR UPDATE OF t`,
    [id]
  )).rows[0];
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Retiro no encontrado.');
  if (row.estado !== 'EN_PROCESO') throw new HttpError(409, 'INVALID_STATE', 'Este retiro ya fue procesado.');
  return row;
}

router.post('/api/admin/retiros/:id/aprobar', ...adminOnly, async (req, res) => {
  const retiro = await withTransaction(async (tx) => {
    const row = await lockRetiro(tx, req.params.id);
    await tx.query("UPDATE transacciones SET estado = 'COMPLETADO', fecha_procesado = NOW() WHERE id_transaccion = $1", [row.id_transaccion]);
    return row;
  });
  audit(req, 'RETIRO_APROBADO', 'transaccion', retiro.id_transaccion, { folio: retiro.folio, monto: retiro.monto });
  realtime.emitToUser(retiro.id_usuario, 'billetera.actualizada', { aviso: `Tu retiro ${retiro.folio} fue enviado a tu banco.` });
  sendPush(retiro.id_usuario, 'Retiro enviado', `Tu retiro ${retiro.folio} fue autorizado y va en camino a tu banco.`);
  res.json({ mensaje: `Retiro ${retiro.folio} autorizado.`, folio: retiro.folio });
});

router.post('/api/admin/retiros/:id/rechazar', ...adminOnly, async (req, res) => {
  const motivo = sanitizeText(req.body?.motivo, 500);
  if (!motivo) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe el motivo del rechazo.', { field: 'motivo' });
  const retiro = await withTransaction(async (tx) => {
    const row = await lockRetiro(tx, req.params.id);
    await tx.query(
      "UPDATE transacciones SET estado = 'RECHAZADO', motivo_rechazo = $1, fecha_procesado = NOW() WHERE id_transaccion = $2",
      [motivo, row.id_transaccion]
    );
    await tx.query(
      'UPDATE billetera_tecnico SET saldo_actual = saldo_actual + $1::numeric, fecha_actualizacion = NOW() WHERE id_billetera = $2',
      [row.monto, row.id_billetera]
    );
    return row;
  });
  audit(req, 'RETIRO_RECHAZADO', 'transaccion', retiro.id_transaccion, { folio: retiro.folio, monto: retiro.monto, motivo });
  realtime.emitToUser(retiro.id_usuario, 'billetera.actualizada', { aviso: `Tu retiro ${retiro.folio} fue rechazado y el monto regresó a tu saldo.` });
  sendPush(retiro.id_usuario, 'Retiro rechazado', `Tu retiro ${retiro.folio} no se procesó; el monto regresó a tu saldo.`);
  res.json({ mensaje: `Retiro ${retiro.folio} rechazado; el monto regresó a la billetera del técnico.`, folio: retiro.folio });
});

// ───────────────────────── Configuración de la plataforma (RF-97, RF-98, RF-99) ─────────────────────────
// La app usa estos valores: comisión en la liquidación, retiro mínimo, radio de búsqueda, minutos para aceptar
// y el modo mantenimiento (503 en toda la API salvo estas rutas de administrador).
router.get('/api/admin/configuracion', ...adminOnly, async (_req, res) => {
  invalidateConfig();
  res.json({ configuracion: await getConfig() });
});

function numberIn(value, min, max) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return n;
}

router.put('/api/admin/configuracion', ...adminOnly, async (req, res) => {
  const b = req.body || {};
  const campos = {
    comision_porcentaje: numberIn(b.comision_porcentaje ?? b.comisionPorcentaje, 0, 50),
    monto_minimo_retiro: numberIn(b.monto_minimo_retiro ?? b.montoMinimoRetiro, 1, 100000),
    radio_maximo_km: numberIn(b.radio_maximo_km ?? b.radioMaximoKm, 1, 200),
    tolerancia_minutos: numberIn(b.tolerancia_minutos ?? b.toleranciaMinutos, 1, 120),
  };
  const invalido = Object.entries(campos).find(([, v]) => Number.isNaN(v));
  if (invalido) return fail(res, 400, 'VALIDATION_ERROR', 'Hay un valor fuera de rango.', { field: invalido[0] });
  if (campos.radio_maximo_km !== undefined) campos.radio_maximo_km = Math.round(campos.radio_maximo_km);
  if (campos.tolerancia_minutos !== undefined) campos.tolerancia_minutos = Math.round(campos.tolerancia_minutos);

  const sensibilidad = b.sensibilidad_ia ?? b.sensibilidadIa;
  if (sensibilidad !== undefined && !['Baja', 'Media', 'Alta'].includes(sensibilidad)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'La sensibilidad debe ser Baja, Media o Alta.', { field: 'sensibilidad_ia' });
  }
  const mantenimiento = b.modo_mantenimiento ?? b.modoMantenimiento;
  if (mantenimiento !== undefined && typeof mantenimiento !== 'boolean') {
    return fail(res, 400, 'VALIDATION_ERROR', 'El modo mantenimiento debe ser verdadero o falso.', { field: 'modo_mantenimiento' });
  }
  const mensaje = b.mensaje_mantenimiento ?? b.mensajeMantenimiento;

  await db().query('INSERT INTO configuracion_plataforma (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  const { rows } = await db().query(
    `UPDATE configuracion_plataforma SET
       comision_porcentaje = COALESCE($1, comision_porcentaje),
       monto_minimo_retiro = COALESCE($2, monto_minimo_retiro),
       radio_maximo_km = COALESCE($3, radio_maximo_km),
       tolerancia_minutos = COALESCE($4, tolerancia_minutos),
       sensibilidad_ia = COALESCE($5, sensibilidad_ia),
       modo_mantenimiento = COALESCE($6, modo_mantenimiento),
       mensaje_mantenimiento = COALESCE($7, mensaje_mantenimiento),
       actualizado_en = CURRENT_TIMESTAMP
     WHERE id = 1 RETURNING *`,
    [
      campos.comision_porcentaje ?? null, campos.monto_minimo_retiro ?? null, campos.radio_maximo_km ?? null,
      campos.tolerancia_minutos ?? null, sensibilidad ?? null, mantenimiento ?? null,
      mensaje === undefined ? null : sanitizeText(mensaje, 300) || null,
    ]
  );
  invalidateConfig();
  audit(req, 'CONFIGURACION_ACTUALIZADA', 'configuracion', 1, { ...campos, sensibilidad_ia: sensibilidad, modo_mantenimiento: mantenimiento });
  res.json({ mensaje: 'Configuración guardada.', configuracion: rows[0] });
});

module.exports = router;
