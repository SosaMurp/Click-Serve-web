const express = require('express');
const bcrypt = require('bcrypt');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const { isStrongPassword } = require('../lib/validators');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { deletionBlocker, anonymizeUser } = require('../services/bajas');
const S = require('../services/solicitudes');

// Dashboard, directorio de usuarios y detalle de servicios del panel de administrador.
// Antes los resolvía un backend aparte con tablas propias; ahora leen las mismas tablas que la app.
const router = express.Router();
const db = () => getPool();
const adminOnly = [auth, requireRole(ROL.ADMIN)];

// Estados de la app agrupados como los muestra el panel.
const ESTATUS_PANEL = `CASE s.estado
  WHEN 'FINALIZADA' THEN 'Completado'
  WHEN 'CANCELADA' THEN 'Cancelado'
  WHEN 'PENDIENTE' THEN 'Pendiente'
  ELSE 'En Curso' END`;
const EN_CURSO = `s.estado IN ('ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'ESPERANDO_APROBACION', 'EN_PROCESO', 'POR_CONFIRMAR', 'SUSPENDIDA')`;
// Técnico en línea: disponible y con latido reciente (RNF-34), igual que para recomendarlo.
const EN_LINEA = `u.id_rol = 2 AND u.disponible = true AND u.ultimo_latido > NOW() - INTERVAL '90 seconds' AND u.anonimizado = false`;

const SERVICIO_SELECT = `
  SELECT s.id_solicitud AS id_servicio, s.folio AS codigo,
         COALESCE(c.nombre, s.categoria, 'Servicio') AS titulo, ${ESTATUS_PANEL} AS estatus, s.estado AS estado_app,
         COALESCE(s.monto_total, s.monto_cotizacion) AS monto, s.direccion, s.fecha_creacion, s.latitud, s.longitud,
         t.nombre AS tecnico_nombre, t.apellido AS tecnico_apellido,
         cl.nombre AS cliente_nombre, cl.apellido AS cliente_apellido
  FROM solicitudes_servicio s
  LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
  LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
  LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario`;

// ───────────────────────── Dashboard ─────────────────────────
router.get('/api/admin/dashboard/stats', ...adminOnly, async (_req, res) => {
  const { rows } = await db().query(`
    WITH
      online AS (SELECT COUNT(*)::int AS n FROM usuarios u WHERE ${EN_LINEA}),
      en_curso AS (SELECT COUNT(*)::int AS n FROM solicitudes_servicio s WHERE ${EN_CURSO}),
      validaciones AS (
        SELECT COUNT(*)::int AS n FROM usuarios u
        WHERE u.id_rol = 2 AND u.anonimizado = false AND u.identidad_verificada = false
          AND UPPER(COALESCE(u.estado_cuenta, '')) NOT IN ('RECHAZADO', 'SUSPENDIDO')
      ),
      hoy AS (SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE estado = 'PAGADO' AND (fecha AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date),
      ayer AS (SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE estado = 'PAGADO' AND (fecha AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date - 1),
      completados AS (
        SELECT COUNT(*)::int AS n FROM solicitudes_servicio s
        WHERE s.estado = 'FINALIZADA' AND DATE_TRUNC('month', COALESCE(s.fecha_finalizacion, s.fecha_creacion)) = DATE_TRUNC('month', NOW())
      ),
      clientes AS (SELECT COUNT(*)::int AS n FROM usuarios WHERE id_rol = 1 AND anonimizado = false)
    SELECT (SELECT n FROM online) AS tecnicos_online,
           (SELECT n FROM en_curso) AS servicios_en_curso,
           (SELECT n FROM validaciones) AS validaciones_pendientes,
           (SELECT total FROM hoy) AS ingresos_hoy,
           (SELECT n FROM completados) AS servicios_completados_mes,
           (SELECT n FROM clientes) AS total_clientes,
           NULL::numeric AS variacion_tecnicos_pct,
           CASE WHEN (SELECT total FROM ayer) = 0 THEN NULL
                ELSE ROUND(((SELECT total FROM hoy) - (SELECT total FROM ayer)) / (SELECT total FROM ayer) * 100, 1) END AS variacion_ingresos_pct`);
  res.json(rows[0]);
});

router.get('/api/admin/dashboard/servicios-mes', ...adminOnly, async (_req, res) => {
  const { rows } = await db().query(`
    WITH rango AS (
      SELECT GENERATE_SERIES(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day'::interval)::date AS fecha
    ), datos AS (
      SELECT s.fecha_creacion::date AS fecha,
             COUNT(*) FILTER (WHERE s.estado = 'FINALIZADA') AS completados,
             COUNT(*) FILTER (WHERE s.estado = 'CANCELADA') AS cancelados,
             COUNT(*) FILTER (WHERE ${EN_CURSO}) AS en_curso
      FROM solicitudes_servicio s
      WHERE s.fecha_creacion >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY 1
    )
    SELECT r.fecha, TO_CHAR(r.fecha, 'DD Mon') AS dia,
           COALESCE(d.completados, 0)::int AS completados, COALESCE(d.cancelados, 0)::int AS cancelados,
           COALESCE(d.en_curso, 0)::int AS en_curso
    FROM rango r LEFT JOIN datos d ON d.fecha = r.fecha
    ORDER BY r.fecha`);
  res.json({
    puntos: rows,
    total_completados: rows.reduce((s, r) => s + r.completados, 0),
    total_cancelados: rows.reduce((s, r) => s + r.cancelados, 0),
  });
});

router.get('/api/admin/dashboard/recent-services', ...adminOnly, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? '8', 10) || 8, 1), 50);
  const { rows } = await db().query(`${SERVICIO_SELECT} ORDER BY s.fecha_creacion DESC LIMIT $1`, [limit]);
  res.json({ servicios: rows, total: rows.length });
});

router.get('/api/admin/dashboard/actividad', ...adminOnly, async (_req, res) => {
  const { rows } = await db().query(`
    (SELECT s.id_solicitud AS id, 'servicio' AS tipo,
            CONCAT(CASE s.estado WHEN 'FINALIZADA' THEN 'Servicio completado: ' WHEN 'CANCELADA' THEN 'Servicio cancelado: '
                                 WHEN 'PENDIENTE' THEN 'Nueva solicitud: ' ELSE 'Servicio en curso: ' END,
                   COALESCE(c.nombre, 'Servicio'), ' (', s.folio, ')') AS descripcion,
            s.direccion AS sub, s.fecha_creacion AS creado_en, (s.estado = 'CANCELADA' OR s.alerta_sos) AS urgente
     FROM solicitudes_servicio s LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
     ORDER BY s.fecha_creacion DESC LIMIT 8)
    UNION ALL
    (SELECT u.id_usuario, 'tecnico', CONCAT('Nuevo técnico registrado: ', u.nombre, ' ', u.apellido),
            CASE WHEN u.identidad_verificada THEN 'Aprobado' ELSE 'Pendiente de revisión' END,
            u.fecha_registro, (u.identidad_verificada = false)
     FROM usuarios u WHERE u.id_rol = 2 AND u.anonimizado = false
     ORDER BY u.fecha_registro DESC LIMIT 5)
    UNION ALL
    (SELECT i.id_incidencia, 'alerta', CONCAT('Incidencia ', i.folio, ': ', CASE i.tipo
              WHEN 'NO_SE_PRESENTO' THEN 'el técnico no llegó' WHEN 'COBRO_INDEBIDO' THEN 'cobro indebido'
              WHEN 'MALA_CALIDAD' THEN 'mala calidad' WHEN 'DANOS' THEN 'daños' WHEN 'SEGURIDAD' THEN 'seguridad / SOS'
              WHEN 'GARANTIA' THEN 'garantía' ELSE 'otro' END),
            i.descripcion, i.fecha_creacion, (i.prioridad = 'ALTA')
     FROM incidencias i WHERE i.estado = 'ABIERTA'
     ORDER BY i.fecha_creacion DESC LIMIT 5)
    ORDER BY creado_en DESC NULLS LAST
    LIMIT 20`);
  res.json({ items: rows });
});

router.get('/api/admin/dashboard/especialidades', ...adminOnly, async (_req, res) => {
  const { rows } = await db().query(`
    SELECT COALESCE(c.nombre, 'Sin categoría') AS especialidad, COUNT(*)::int AS total,
           ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS porcentaje
    FROM solicitudes_servicio s LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
    WHERE s.estado = 'FINALIZADA' AND s.fecha_creacion >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY 1 ORDER BY total DESC LIMIT 8`);
  res.json(rows);
});

// ───────────────────────── Servicios (buscador y detalle del panel) ─────────────────────────
router.get('/api/admin/solicitudes', ...adminOnly, async (_req, res) => {
  const { rows } = await db().query(`${SERVICIO_SELECT} ORDER BY s.fecha_creacion DESC LIMIT 500`);
  res.json({ servicios: rows });
});

router.get('/api/admin/solicitudes/:id', ...adminOnly, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'VALIDATION_ERROR', 'ID de servicio inválido.');
  const { rows } = await db().query(`${SERVICIO_SELECT} WHERE s.id_solicitud = $1`, [id]);
  if (!rows[0]) return fail(res, 404, 'NOT_FOUND', 'Servicio no encontrado.');
  res.json(rows[0]);
});

// El avance de la orden lo marcan técnico y cliente en la app; soporte solo puede cancelarla sin cargo.
router.patch('/api/admin/solicitudes/:id/estado', ...adminOnly, async (req, res) => {
  const estatus = String(req.body?.estatus || '').toLowerCase();
  if (!estatus.startsWith('cancel')) {
    return fail(res, 409, 'STATE_OWNED_BY_APP', 'El avance del servicio lo registran el técnico y el cliente desde la app. Desde el panel solo se puede cancelar.');
  }
  const motivo = sanitizeText(req.body?.motivoCambio || req.body?.mensajePersonalizado, 300) || 'Cancelado por soporte de Click & Serve';
  const row = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'Servicio no encontrado.');
    if (['FINALIZADA', 'CANCELADA'].includes(current.estado)) throw new HttpError(409, 'INVALID_STATE', 'El servicio ya está cerrado.');
    if (current.estado_pago === 'PROCESANDO' || current.estado_pago === 'PAGADO') {
      throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'El servicio ya tiene un cobro; atiéndelo como incidencia.');
    }
    await tx.query(
      `UPDATE solicitudes_servicio SET estado = 'CANCELADA', estado_previo = NULL, cancelado_por = 'ADMIN',
         motivo_cancelacion = $1, estado_pago = 'NO_APLICA' WHERE id_solicitud = $2`,
      [motivo, current.id_solicitud]
    );
    return S.findRow(current.id_solicitud, tx);
  });
  audit(req, 'SOLICITUD_CANCELADA_ADMIN', 'solicitud', row.id_solicitud, { motivo });
  const aviso = `Soporte canceló el servicio ${row.folio} sin cargo: ${motivo}`;
  for (const id of [row.id_usuario, row.id_tecnico].filter(Boolean)) {
    realtime.emitToUser(id, 'solicitud.actualizada', { id_solicitud: Number(row.id_solicitud), estado: row.estado, aviso });
  }
  if (req.body?.notificarCliente) sendPush(row.id_usuario, 'Servicio cancelado', aviso);
  res.json({ mensaje: `Servicio ${row.folio} cancelado sin cargo.`, servicio: { id_servicio: row.id_solicitud, estatus: 'Cancelado' } });
});

// ───────────────────────── Búsqueda global (RF-44) ─────────────────────────
// Resultados segmentados entre técnicos, clientes y servicios. `tipo` limita la búsqueda a un segmento.
router.get('/api/admin/buscar', ...adminOnly, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const tipo = String(req.query.tipo || 'todos').toLowerCase();
  if (!['todos', 'tecnicos', 'clientes', 'servicios'].includes(tipo)) return fail(res, 400, 'VALIDATION_ERROR', 'Tipo de búsqueda no válido.', { field: 'tipo' });
  const vacio = { tecnicos: [], clientes: [], servicios: [] };
  if (q.length < 2) return res.json({ q, ...vacio });

  const patron = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const limite = tipo === 'todos' ? 5 : 25;
  const personas = (rol) => db().query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.estado_cuenta
     FROM usuarios u
     WHERE u.id_rol = $1 AND u.anonimizado = false
       AND (CONCAT(u.nombre, ' ', u.apellido) ILIKE $2 OR u.correo ILIKE $2 OR u.telefono ILIKE $2 OR ('ID-' || u.id_usuario) ILIKE $2)
     ORDER BY u.id_usuario DESC LIMIT $3`,
    [rol, patron, limite]
  ).then((r) => r.rows);
  const servicios = () => db().query(
    `SELECT s.id_solicitud, s.folio, s.estado, COALESCE(c.nombre, s.categoria) AS categoria,
            CONCAT(cl.nombre, ' ', cl.apellido) AS cliente, CONCAT(t.nombre, ' ', t.apellido) AS tecnico
     FROM solicitudes_servicio s
     LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
     LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario
     LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
     WHERE s.folio ILIKE $1 OR s.descripcion ILIKE $1 OR s.direccion ILIKE $1
     ORDER BY s.fecha_creacion DESC LIMIT $2`,
    [patron, limite]
  ).then((r) => r.rows);

  const [tecnicos, clientes, srv] = await Promise.all([
    tipo === 'todos' || tipo === 'tecnicos' ? personas(2) : [],
    tipo === 'todos' || tipo === 'clientes' ? personas(1) : [],
    tipo === 'todos' || tipo === 'servicios' ? servicios() : [],
  ]);
  res.json({ q, tecnicos, clientes, servicios: srv });
});

// ───────────────────────── Directorio de usuarios (RF-16, RF-17, RF-26, RF-32, RF-33, RF-37, RF-38) ─────────────────────────
router.get('/api/admin/users', ...adminOnly, async (req, res) => {
  const { role, status, specialty, search } = req.query;
  const params = [];
  const where = ['u.anonimizado = false'];
  const rol = { tech: 2, '2': 2, client: 1, '1': 1, admin: 3, '3': 3 }[role];
  if (rol) { params.push(rol); where.push(`u.id_rol = $${params.length}`); }
  if (status) { params.push(String(status)); where.push(`UPPER(u.estado_cuenta) = UPPER($${params.length})`); }
  if (specialty) {
    params.push(`%${specialty}%`);
    where.push(`EXISTS (SELECT 1 FROM especialidades_tecnico e LEFT JOIN categorias_servicio c ON c.codigo = e.categoria
                        WHERE e.id_usuario = u.id_usuario AND COALESCE(c.nombre, e.nombre) ILIKE $${params.length})`);
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`(u.nombre ILIKE ${p} OR u.apellido ILIKE ${p} OR u.correo ILIKE ${p} OR u.telefono ILIKE ${p})`);
  }
  const { rows } = await db().query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.id_rol, u.estado_cuenta, u.fecha_nacimiento,
            u.identidad_verificada, u.fecha_registro,
            (SELECT string_agg(COALESCE(c.nombre, e.nombre), ', ' ORDER BY c.orden) FROM especialidades_tecnico e
               LEFT JOIN categorias_servicio c ON c.codigo = e.categoria WHERE e.id_usuario = u.id_usuario) AS especialidad,
            CASE WHEN u.id_rol <> 2 THEN NULL WHEN u.identidad_verificada THEN 'Aprobado' ELSE 'Pendiente' END AS estatus_expediente,
            CASE WHEN u.id_rol = 2 THEN json_build_object(
              'calificacion', (SELECT ROUND(AVG(q.puntuacion_tecnico)::numeric, 1) FROM calificaciones_servicio q WHERE q.id_tecnico = u.id_usuario),
              'trabajos', (SELECT COUNT(*) FROM solicitudes_servicio f WHERE f.id_tecnico = u.id_usuario AND f.estado = 'FINALIZADA')
            ) END AS metricas
     FROM usuarios u
     WHERE ${where.join(' AND ')}
     ORDER BY u.id_usuario DESC
     LIMIT 1000`,
    params
  );
  res.json(rows);
});

// RF-26: alta de coadministrador por un administrador (el registro público no crea administradores).
router.post('/api/admin/co-admins', ...adminOnly, async (req, res) => {
  const nombre = sanitizeText(req.body?.nombre, 100);
  const apellido = sanitizeText(req.body?.apellidos ?? req.body?.apellido, 100);
  const correo = String(req.body?.email || req.body?.correo || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!nombre || !apellido) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe nombre y apellidos.', { field: 'nombre' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe un correo válido.', { field: 'email' });
  if (!isStrongPassword(password)) {
    return fail(res, 400, 'WEAK_PASSWORD', 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.', { field: 'password' });
  }
  try {
    const { rows } = await db().query(
      `INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, id_rol, estado, estado_cuenta, identidad_verificada)
       VALUES ($1, $2, $3, $4, $5, 3, 'APROBADO', 'Activo', true) RETURNING id_usuario`,
      [nombre, apellido, correo, await bcrypt.hash(password, 10), sanitizeText(req.body?.telefono, 15) || null]
    );
    audit(req, 'COADMIN_CREADO', 'usuario', rows[0].id_usuario, { correo });
    res.status(201).json({ mensaje: 'Coadministrador registrado. Ya puede iniciar sesión en el panel.', id_usuario: rows[0].id_usuario });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'EMAIL_TAKEN', 'Ese correo ya está registrado.', { field: 'email' });
    throw error;
  }
});

// RF-17: expediente completo para descarga (sin contraseña ni secretos).
router.get('/api/admin/users/:id/export', ...adminOnly, async (req, res) => {
  const usuario = (await db().query(
    `SELECT id_usuario, id_rol, nombre, apellido, correo, telefono, fecha_nacimiento, estado_cuenta, identidad_verificada,
            verificado_sep, fecha_registro, fecha_revision, motivo_rechazo
     FROM usuarios WHERE id_usuario = $1 AND anonimizado = false`,
    [req.params.id]
  )).rows[0];
  if (!usuario) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');
  const [documentos, especialidades, solicitudes, calificaciones] = await Promise.all([
    db().query('SELECT tipo, estado, numero, descripcion, fecha_creacion FROM documentos_usuario WHERE id_usuario = $1 ORDER BY fecha_creacion', [usuario.id_usuario]),
    db().query('SELECT categoria, nombre, estado, activa FROM especialidades_tecnico WHERE id_usuario = $1', [usuario.id_usuario]),
    db().query(
      `SELECT folio, categoria, estado, fecha_creacion, fecha_finalizacion, monto_total
       FROM solicitudes_servicio WHERE id_usuario = $1 OR id_tecnico = $1 ORDER BY fecha_creacion DESC`,
      [usuario.id_usuario]
    ),
    db().query('SELECT puntuacion_tecnico, comentario_tecnico FROM calificaciones_servicio WHERE id_tecnico = $1', [usuario.id_usuario]).catch(() => ({ rows: [] })),
  ]);
  audit(req, 'EXPEDIENTE_EXPORTADO', 'usuario', usuario.id_usuario);
  res.json({
    expediente_completo: {
      usuario,
      documentos: documentos.rows,
      especialidades: especialidades.rows,
      solicitudes: solicitudes.rows,
      calificaciones: calificaciones.rows,
      fecha_exportacion: new Date().toISOString(),
    },
  });
});

// RF-32: suspensión inmediata (cierra todas las sesiones; la app ya no deja iniciar sesión).
router.post('/api/admin/users/:id/suspend', ...adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id_usuario) return fail(res, 409, 'SELF_ACTION', 'No puedes suspender tu propia cuenta.');
  const { rows } = await db().query(
    `UPDATE usuarios SET estado_cuenta = 'SUSPENDIDO', disponible = false WHERE id_usuario = $1 AND anonimizado = false RETURNING id_usuario`,
    [req.params.id]
  );
  if (!rows[0]) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');
  await db().query("UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1 AND estado = 'activa'", [req.params.id]);
  realtime.revalidateSessions();
  audit(req, 'USUARIO_SUSPENDIDO', 'usuario', req.params.id);
  res.json({ mensaje: 'Cuenta suspendida y sesiones cerradas.' });
});

// RF-33: restaura el estatus operativo (aprobado si su identidad ya estaba verificada).
router.post('/api/admin/users/:id/reactivate', ...adminOnly, async (req, res) => {
  const { rows } = await db().query(
    `UPDATE usuarios SET estado_cuenta = CASE WHEN identidad_verificada THEN 'APROBADO' ELSE 'Activo' END, motivo_rechazo = NULL
     WHERE id_usuario = $1 AND anonimizado = false RETURNING id_usuario`,
    [req.params.id]
  );
  if (!rows[0]) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');
  audit(req, 'USUARIO_REACTIVADO', 'usuario', req.params.id);
  realtime.emitToUser(Number(req.params.id), 'cuenta.aprobada', { aviso: 'Tu cuenta fue reactivada.' });
  res.json({ mensaje: 'Estatus operativo restaurado.' });
});

// RF-16: baja definitiva desde el panel. Anonimiza igual que la baja desde la app y pide la contraseña del admin.
router.delete('/api/admin/users/:id', ...adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id_usuario) return fail(res, 409, 'SELF_ACTION', 'No puedes eliminar tu propia cuenta desde aquí.');
  const admin = (await db().query('SELECT contrasena FROM usuarios WHERE id_usuario = $1', [req.user.id_usuario])).rows[0];
  if (!req.body?.password || !(await bcrypt.compare(String(req.body.password), admin.contrasena))) {
    return fail(res, 403, 'PASSWORD_INCORRECT', 'Confirma con tu contraseña de administrador.');
  }
  const exists = (await db().query('SELECT 1 FROM usuarios WHERE id_usuario = $1 AND anonimizado = false', [id])).rowCount;
  if (!exists) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');
  const blocker = await deletionBlocker(id);
  if (blocker) return fail(res, 409, blocker.code, blocker.message);
  await anonymizeUser(id);
  realtime.revalidateSessions();
  audit(req, 'CUENTA_ELIMINADA_ADMIN', 'usuario', id);
  res.json({ mensaje: 'Cuenta eliminada definitivamente. Sus datos personales fueron anonimizados.' });
});

module.exports = router;
