const express = require('express');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const { isStrongPassword, isEmail, normalizeEmail, normalizePhoneMx, normalizePersonName } = require('../lib/validators');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { deletionBlocker, anonymizeUser } = require('../services/bajas');
const S = require('../services/solicitudes');
const { signFileUrl } = require('../lib/files');
const { sendMail, tempPasswordEmailHtml } = require('../lib/mailer');
const { generateTempPassword, HORAS_TEMPORAL } = require('../lib/temporal');
const { todayMx } = require('../lib/dates');

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
         COALESCE(s.monto_total, s.monto_cotizacion) AS monto, s.direccion, s.fecha_creacion, s.latitud, s.longitud, COALESCE(s.alerta_sos, false) AS alerta_sos,
         t.nombre AS tecnico_nombre, t.apellido AS tecnico_apellido,
         cl.nombre AS cliente_nombre, cl.apellido AS cliente_apellido
  FROM solicitudes_servicio s
  LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
  LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
  LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario`;

// ───────────────────────── Dashboard ─────────────────────────
// Rango de fechas que elige el administrador (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD, ambos inclusivos y en la
// fecha de Lázaro Cárdenas). Sin parámetros se usan los últimos 30 días. Máximo un año.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;
const MAX_DIAS = 366;
const aMs = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const aIso = (ms) => new Date(ms).toISOString().slice(0, 10);

function parseRango(req, { opcional = false } = {}) {
  const { desde, hasta } = req.query;
  if (desde == null && hasta == null) {
    if (opcional) return null;
    const fin = todayMx();
    return { desde: aIso(aMs(fin) - 29 * DIA_MS), hasta: fin };
  }
  const valida = (v) => ISO_DATE.test(String(v)) && aIso(aMs(String(v))) === String(v);
  if (!valida(desde) || !valida(hasta)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Las fechas deben tener el formato AAAA-MM-DD.', { field: 'desde' });
  }
  const dias = (aMs(hasta) - aMs(desde)) / DIA_MS + 1;
  if (dias < 1) throw new HttpError(400, 'VALIDATION_ERROR', 'La fecha de inicio no puede ser posterior a la de fin.', { field: 'desde' });
  if (dias > MAX_DIAS) throw new HttpError(400, 'VALIDATION_ERROR', 'El rango máximo es de un año.', { field: 'hasta' });
  return { desde: String(desde), hasta: String(hasta) };
}

// Periodo inmediatamente anterior y de la misma duración (para las variaciones).
function periodoAnterior({ desde, hasta }) {
  const dias = (aMs(hasta) - aMs(desde)) / DIA_MS + 1;
  return { desde: aIso(aMs(desde) - dias * DIA_MS), hasta: aIso(aMs(desde) - DIA_MS) };
}

const MX = "'America/Mexico_City'";

router.get('/api/admin/dashboard/stats', ...adminOnly, async (req, res) => {
  const rango = parseRango(req);
  const previo = periodoAnterior(rango);
  const { rows } = await db().query(`
    WITH
      online AS (SELECT COUNT(*)::int AS n FROM usuarios u WHERE ${EN_LINEA}),
      en_curso AS (SELECT COUNT(*)::int AS n FROM solicitudes_servicio s WHERE ${EN_CURSO}),
      validaciones AS (
        SELECT COUNT(*)::int AS n FROM usuarios u
        WHERE u.id_rol = 2 AND u.anonimizado = false AND u.identidad_verificada = false
          AND UPPER(COALESCE(u.estado_cuenta, '')) NOT IN ('RECHAZADO', 'SUSPENDIDO')
      ),
      hoy AS (SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE estado = 'PAGADO' AND (fecha AT TIME ZONE ${MX})::date = (NOW() AT TIME ZONE ${MX})::date),
      periodo AS (SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE estado = 'PAGADO' AND (fecha AT TIME ZONE ${MX})::date BETWEEN $1::date AND $2::date),
      previo AS (SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE estado = 'PAGADO' AND (fecha AT TIME ZONE ${MX})::date BETWEEN $3::date AND $4::date),
      completados_periodo AS (
        SELECT COUNT(*)::int AS n FROM solicitudes_servicio s
        WHERE s.estado = 'FINALIZADA' AND (COALESCE(s.fecha_finalizacion, s.fecha_creacion) AT TIME ZONE ${MX})::date BETWEEN $1::date AND $2::date
      ),
      completados_previo AS (
        SELECT COUNT(*)::int AS n FROM solicitudes_servicio s
        WHERE s.estado = 'FINALIZADA' AND (COALESCE(s.fecha_finalizacion, s.fecha_creacion) AT TIME ZONE ${MX})::date BETWEEN $3::date AND $4::date
      ),
      completados_mes AS (
        SELECT COUNT(*)::int AS n FROM solicitudes_servicio s
        WHERE s.estado = 'FINALIZADA' AND DATE_TRUNC('month', COALESCE(s.fecha_finalizacion, s.fecha_creacion)) = DATE_TRUNC('month', NOW())
      ),
      clientes AS (SELECT COUNT(*)::int AS n FROM usuarios WHERE id_rol = 1 AND anonimizado = false)
    SELECT (SELECT n FROM online) AS tecnicos_online,
           (SELECT n FROM en_curso) AS servicios_en_curso,
           (SELECT n FROM validaciones) AS validaciones_pendientes,
           (SELECT total FROM hoy) AS ingresos_hoy,
           (SELECT total FROM periodo) AS ingresos_periodo,
           (SELECT n FROM completados_periodo) AS servicios_completados_periodo,
           (SELECT n FROM completados_mes) AS servicios_completados_mes,
           (SELECT n FROM clientes) AS total_clientes,
           NULL::numeric AS variacion_tecnicos_pct,
           CASE WHEN (SELECT total FROM previo) = 0 THEN NULL
                ELSE ROUND(((SELECT total FROM periodo) - (SELECT total FROM previo)) / (SELECT total FROM previo) * 100, 1) END AS variacion_ingresos_pct,
           CASE WHEN (SELECT n FROM completados_previo) = 0 THEN NULL
                ELSE ROUND(((SELECT n FROM completados_periodo) - (SELECT n FROM completados_previo))::numeric / (SELECT n FROM completados_previo) * 100, 1) END AS variacion_completados_pct`,
    [rango.desde, rango.hasta, previo.desde, previo.hasta]);
  res.json({ ...rows[0], periodo: rango });
});

router.get('/api/admin/dashboard/servicios-mes', ...adminOnly, async (req, res) => {
  const rango = parseRango(req);
  const { rows } = await db().query(`
    WITH rango AS (
      SELECT GENERATE_SERIES($1::date, $2::date, '1 day'::interval)::date AS fecha
    ), datos AS (
      SELECT (s.fecha_creacion AT TIME ZONE ${MX})::date AS fecha,
             COUNT(*) FILTER (WHERE s.estado = 'FINALIZADA') AS completados,
             COUNT(*) FILTER (WHERE s.estado = 'CANCELADA') AS cancelados,
             COUNT(*) FILTER (WHERE ${EN_CURSO}) AS en_curso
      FROM solicitudes_servicio s
      WHERE (s.fecha_creacion AT TIME ZONE ${MX})::date BETWEEN $1::date AND $2::date
      GROUP BY 1
    )
    SELECT TO_CHAR(r.fecha, 'YYYY-MM-DD') AS fecha,
           COALESCE(d.completados, 0)::int AS completados, COALESCE(d.cancelados, 0)::int AS cancelados,
           COALESCE(d.en_curso, 0)::int AS en_curso
    FROM rango r LEFT JOIN datos d ON d.fecha = r.fecha
    ORDER BY r.fecha`, [rango.desde, rango.hasta]);
  res.json({
    periodo: rango,
    puntos: rows,
    total_completados: rows.reduce((s, r) => s + r.completados, 0),
    total_cancelados: rows.reduce((s, r) => s + r.cancelados, 0),
  });
});

// Técnicos con más servicios finalizados en el rango.
router.get('/api/admin/dashboard/tecnicos-destacados', ...adminOnly, async (req, res) => {
  const rango = parseRango(req);
  const { rows } = await db().query(`
    SELECT t.id_usuario, t.nombre, t.apellido, COUNT(*)::int AS servicios, COALESCE(SUM(s.monto_total), 0) AS monto
    FROM solicitudes_servicio s JOIN usuarios t ON t.id_usuario = s.id_tecnico
    WHERE s.estado = 'FINALIZADA'
      AND (COALESCE(s.fecha_finalizacion, s.fecha_creacion) AT TIME ZONE ${MX})::date BETWEEN $1::date AND $2::date
    GROUP BY t.id_usuario, t.nombre, t.apellido
    ORDER BY servicios DESC, monto DESC
    LIMIT 5`, [rango.desde, rango.hasta]);
  res.json({ periodo: rango, tecnicos: rows });
});

// Centro de actividad: servicios, técnicos nuevos, incidencias abiertas, retiros por autorizar y tickets
// de soporte sin atender, en un solo feed paginado. `tipo` limita a un grupo (servicios, tecnicos, alertas,
// finanzas, soporte); con ?desde&hasta solo muestra lo ocurrido en el rango. Cada elemento trae `tipo` e `id`
// para que el panel abra el servicio, el técnico, la incidencia, el retiro o el ticket.
const GRUPOS_ACTIVIDAD = {
  servicios: ['servicio'],
  tecnicos: ['tecnico'],
  alertas: ['alerta'],
  finanzas: ['retiro'],
  soporte: ['ticket'],
};

router.get('/api/admin/dashboard/actividad', ...adminOnly, async (req, res) => {
  const rango = parseRango(req, { opcional: true });
  const grupo = String(req.query.tipo || 'todos').toLowerCase();
  if (grupo !== 'todos' && !GRUPOS_ACTIVIDAD[grupo]) return fail(res, 400, 'VALIDATION_ERROR', 'Tipo de actividad no válido.', { field: 'tipo' });
  const limite = Math.min(Math.max(parseInt(req.query.limite ?? '20', 10) || 20, 1), 50);
  const pagina = Math.max(parseInt(req.query.pagina ?? '1', 10) || 1, 1);
  const incluir = (t) => grupo === 'todos' || GRUPOS_ACTIVIDAD[grupo].includes(t);
  const params = rango ? [rango.desde, rango.hasta] : [];
  const en = (col) => (rango ? `AND (${col} AT TIME ZONE ${MX})::date BETWEEN $1::date AND $2::date` : '');

  const ramas = [];
  if (incluir('servicio')) {
    ramas.push(`SELECT s.id_solicitud::int AS id, 'servicio' AS tipo,
            CONCAT(CASE s.estado WHEN 'FINALIZADA' THEN 'Servicio completado: ' WHEN 'CANCELADA' THEN 'Servicio cancelado: '
                                 WHEN 'PENDIENTE' THEN 'Nueva solicitud: ' ELSE 'Servicio en curso: ' END,
                   COALESCE(c.nombre, 'Servicio'), ' (', s.folio, ')') AS descripcion,
            s.direccion AS sub, s.fecha_creacion AS creado_en, COALESCE(s.estado = 'CANCELADA' OR s.alerta_sos, false) AS urgente
     FROM solicitudes_servicio s LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
     WHERE TRUE ${en('s.fecha_creacion')}`);
  }
  if (incluir('tecnico')) {
    ramas.push(`SELECT u.id_usuario::int, 'tecnico', CONCAT('Nuevo técnico registrado: ', u.nombre, ' ', u.apellido),
            CASE WHEN u.identidad_verificada THEN 'Aprobado' ELSE 'Pendiente de revisión' END,
            u.fecha_registro, (u.identidad_verificada = false)
     FROM usuarios u WHERE u.id_rol = 2 AND u.anonimizado = false ${en('u.fecha_registro')}`);
  }
  if (incluir('alerta')) {
    ramas.push(`SELECT i.id_incidencia::int, 'alerta', CONCAT('Incidencia ', i.folio, ': ', CASE i.tipo
              WHEN 'NO_SE_PRESENTO' THEN 'el técnico no llegó' WHEN 'COBRO_INDEBIDO' THEN 'cobro indebido'
              WHEN 'MALA_CALIDAD' THEN 'mala calidad' WHEN 'DANOS' THEN 'daños' WHEN 'SEGURIDAD' THEN 'seguridad / SOS'
              WHEN 'GARANTIA' THEN 'garantía' ELSE 'otro' END),
            i.descripcion, i.fecha_creacion, (i.prioridad = 'ALTA')
     FROM incidencias i WHERE i.estado = 'ABIERTA' ${en('i.fecha_creacion')}`);
  }
  if (incluir('retiro')) {
    ramas.push(`SELECT t.id_transaccion::int, 'retiro', CONCAT('Retiro por autorizar: $', TRIM(TO_CHAR(t.monto, 'FM999,999,990.00')), ' (', t.folio, ')'),
            CONCAT(u.nombre, ' ', u.apellido), t.fecha, false
     FROM transacciones t JOIN billetera_tecnico b ON b.id_billetera = t.id_billetera JOIN usuarios u ON u.id_usuario = b.id_usuario
     WHERE t.tipo = 'RETIRO' AND t.estado = 'EN_PROCESO' ${en('t.fecha')}`);
  }
  if (incluir('ticket')) {
    ramas.push(`SELECT k.id_ticket::int, 'ticket', CONCAT('Ticket de soporte ', k.folio, ': ', k.asunto),
            CONCAT(u.nombre, ' ', u.apellido), k.fecha_creacion, (k.prioridad = 'ALTA')
     FROM soporte_tickets k JOIN usuarios u ON u.id_usuario = k.id_usuario
     WHERE k.estado <> 'CERRADO' ${en('k.fecha_creacion')}`);
  }

  const { rows } = await db().query(
    `SELECT * FROM (${ramas.map((r) => `(${r})`).join(' UNION ALL ')}) a(id, tipo, descripcion, sub, creado_en, urgente)
     ORDER BY creado_en DESC NULLS LAST, id DESC LIMIT ${limite + 1} OFFSET ${(pagina - 1) * limite}`,
    params
  );
  res.json({ items: rows.slice(0, limite), pagina, limite, hay_mas: rows.length > limite });
});

// Lo que espera una decisión del administrador (alimenta "Por atender" del tablero y la campana).
router.get('/api/admin/dashboard/pendientes', ...adminOnly, async (_req, res) => {
  const { rows } = await db().query(`
    SELECT (SELECT COUNT(*)::int FROM usuarios u WHERE u.id_rol = 2 AND u.anonimizado = false AND u.identidad_verificada = false
              AND UPPER(COALESCE(u.estado_cuenta, '')) NOT IN ('RECHAZADO', 'SUSPENDIDO')) AS validaciones,
           (SELECT COUNT(*)::int FROM transacciones WHERE tipo = 'RETIRO' AND estado = 'EN_PROCESO') AS retiros,
           (SELECT COUNT(*)::int FROM incidencias WHERE estado = 'ABIERTA') AS incidencias,
           (SELECT COUNT(*)::int FROM soporte_tickets t WHERE t.estado <> 'CERRADO'
              AND NOT COALESCE((SELECT m.es_asesor FROM soporte_mensajes m WHERE m.id_ticket = t.id_ticket
                                ORDER BY m.fecha_envio DESC, m.id_mensaje DESC LIMIT 1), false)) AS tickets`);
  res.json(rows[0]);
});

router.get('/api/admin/dashboard/especialidades', ...adminOnly, async (req, res) => {
  const rango = parseRango(req);
  const { rows } = await db().query(`
    SELECT COALESCE(c.nombre, 'Sin categoría') AS especialidad, COUNT(*)::int AS total,
           ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS porcentaje
    FROM solicitudes_servicio s LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
    WHERE s.estado = 'FINALIZADA' AND (s.fecha_creacion AT TIME ZONE ${MX})::date BETWEEN $1::date AND $2::date
    GROUP BY 1 ORDER BY total DESC LIMIT 8`, [rango.desde, rango.hasta]);
  res.json(rows);
});

// ───────────────────────── Servicios (lista del panel) ─────────────────────────
// Todos los servicios con filtro por estado, búsqueda y fechas. Los conteos por estado respetan la búsqueda y las
// fechas pero no el filtro de estado, para que las pestañas de la pantalla siempre sumen lo mismo.
const GRUPOS_ESTATUS = { pendiente: 'Pendiente', en_curso: 'En Curso', completado: 'Completado', cancelado: 'Cancelado' };

router.get('/api/admin/servicios', ...adminOnly, async (req, res) => {
  const estado = String(req.query.estado || 'todos').toLowerCase();
  if (estado !== 'todos' && !GRUPOS_ESTATUS[estado]) return fail(res, 400, 'VALIDATION_ERROR', 'Estado no válido.', { field: 'estado' });
  const rango = parseRango(req, { opcional: true });
  const limite = Math.min(Math.max(parseInt(req.query.limite ?? '25', 10) || 25, 1), 100);
  const pagina = Math.max(parseInt(req.query.pagina ?? '1', 10) || 1, 1);
  const q = String(req.query.q || '').trim().slice(0, 80);

  const params = [];
  const donde = [];
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    const n = params.length;
    donde.push(`(s.folio ILIKE $${n} OR s.descripcion ILIKE $${n} OR s.direccion ILIKE $${n}
      OR CONCAT(cl.nombre, ' ', cl.apellido) ILIKE $${n} OR CONCAT(t.nombre, ' ', t.apellido) ILIKE $${n})`);
  }
  if (rango) {
    params.push(rango.desde, rango.hasta);
    donde.push(`(s.fecha_creacion AT TIME ZONE ${MX})::date BETWEEN $${params.length - 1}::date AND $${params.length}::date`);
  }
  const filtro = donde.length ? `WHERE ${donde.join(' AND ')}` : '';
  const desde = `FROM solicitudes_servicio s
    LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
    LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
    LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario`;

  const conteos = (await db().query(
    `SELECT ${ESTATUS_PANEL} AS estatus, COUNT(*)::int AS n ${desde} ${filtro} GROUP BY 1`, params
  )).rows;
  const por = Object.fromEntries(conteos.map((r) => [r.estatus, r.n]));
  const totales = { todos: conteos.reduce((a, r) => a + r.n, 0) };
  for (const [clave, etiqueta] of Object.entries(GRUPOS_ESTATUS)) totales[clave] = por[etiqueta] ?? 0;

  const filtroEstado = estado === 'todos' ? '' : `${filtro ? 'AND' : 'WHERE'} (${ESTATUS_PANEL}) = $${params.length + 1}`;
  const paramsLista = estado === 'todos' ? params : [...params, GRUPOS_ESTATUS[estado]];
  const { rows } = await db().query(
    `SELECT s.id_solicitud::int AS id_servicio, s.folio AS codigo, COALESCE(c.nombre, s.categoria, 'Servicio') AS titulo,
            ${ESTATUS_PANEL} AS estatus, s.estado AS estado_app, COALESCE(s.monto_total, s.monto_cotizacion) AS monto,
            s.direccion, s.fecha_creacion, COALESCE(s.alerta_sos, false) AS alerta_sos,
            t.nombre AS tecnico_nombre, t.apellido AS tecnico_apellido, cl.nombre AS cliente_nombre, cl.apellido AS cliente_apellido
     ${desde} ${filtro} ${filtroEstado}
     ORDER BY s.fecha_creacion DESC, s.id_solicitud DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
    paramsLista
  );
  const total = totales[estado];
  res.json({ servicios: rows, pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)), conteos: totales });
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

  // Expediente del servicio para el panel: lo mismo que registran cliente y técnico en la app.
  const [extra, tareas, evidencias, calificacion, pago, incidencias] = await Promise.all([
    db().query(
      `SELECT s.id_usuario AS id_cliente, s.id_tecnico, s.descripcion, s.referencias, s.estado_pago,
              to_char(s.fecha_preferida, 'YYYY-MM-DD') AS fecha_preferida, to_char(s.hora_preferida, 'HH24:MI') AS hora_preferida,
              s.fecha_asignacion, s.fecha_llegada, s.fecha_finalizacion, s.cancelado_por, s.motivo_cancelacion,
              COALESCE(s.alerta_sos, false) AS alerta_sos,
              cl.telefono AS cliente_telefono, cl.correo AS cliente_correo, t.telefono AS tecnico_telefono
       FROM solicitudes_servicio s
       LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario
       LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
       WHERE s.id_solicitud = $1`,
      [id]
    ),
    db().query('SELECT id_tarea, descripcion, norma, completada, fecha_completada FROM tareas_servicio WHERE id_solicitud = $1 ORDER BY orden, id_tarea', [id]),
    db().query('SELECT id_evidencia, tipo_evidencia, descripcion, id_archivo, fecha_subida FROM evidencias_servicio WHERE id_solicitud = $1 ORDER BY id_evidencia', [id]),
    db().query(
      `SELECT puntuacion_tecnico, comentario_cliente, puntuacion_cliente, comentario_tecnico, fecha_calificacion
       FROM calificaciones_servicio WHERE id_solicitud = $1`,
      [id]
    ),
    db().query('SELECT monto, modo, referencia, estado, fecha, monto_reembolsado FROM pagos WHERE id_solicitud = $1', [id]),
    db().query('SELECT id_incidencia, folio, tipo, estado, prioridad, fecha_creacion FROM incidencias WHERE id_solicitud = $1 ORDER BY id_incidencia DESC', [id]),
  ]);

  res.json({
    ...rows[0],
    ...extra.rows[0],
    tareas: tareas.rows,
    evidencias: evidencias.rows.map(({ id_archivo, ...e }) => ({ ...e, url: signFileUrl(id_archivo) })),
    calificacion: calificacion.rows[0] || null,
    pago: pago.rows[0] || null,
    incidencias: incidencias.rows,
  });
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
            u.identidad_verificada, u.fecha_registro, u.ultima_conexion, u.debe_cambiar_contrasena,
            (SELECT string_agg(COALESCE(c.nombre, e.nombre), ', ' ORDER BY c.orden) FROM especialidades_tecnico e
               LEFT JOIN categorias_servicio c ON c.codigo = e.categoria WHERE e.id_usuario = u.id_usuario) AS especialidad,
            CASE WHEN u.id_rol <> 2 THEN NULL WHEN u.identidad_verificada THEN 'Aprobado' ELSE 'Pendiente' END AS estatus_expediente,
            CASE WHEN u.id_rol = 2 THEN json_build_object(
              'calificacion', (SELECT ROUND(AVG(q.puntuacion_tecnico)::numeric, 1) FROM calificaciones_servicio q WHERE q.id_tecnico = u.id_usuario),
              'trabajos', (SELECT COUNT(*) FROM solicitudes_servicio f WHERE f.id_tecnico = u.id_usuario AND f.estado = 'FINALIZADA')
            ) WHEN u.id_rol = 1 THEN json_build_object(
              'servicios', (SELECT COUNT(*)::int FROM solicitudes_servicio f WHERE f.id_usuario = u.id_usuario)
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
  const nombre = normalizePersonName(sanitizeText(req.body?.nombre, 100));
  const apellido = normalizePersonName(sanitizeText(req.body?.apellidos ?? req.body?.apellido, 100), 80);
  const correo = normalizeEmail(req.body?.email || req.body?.correo);
  const telefonoRaw = req.body?.telefono;
  const telefono = telefonoRaw ? normalizePhoneMx(telefonoRaw) : null;
  if (!nombre || !apellido) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe nombre y apellidos usando solo letras.', { field: 'nombre' });
  if (!isEmail(correo)) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe un correo electrónico válido.', { field: 'email' });
  if (telefonoRaw && !telefono) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe un teléfono de 10 dígitos, por ejemplo 753 123 4567.', { field: 'telefono' });

  // La contraseña la genera el sistema y solo viaja por correo: quien da de alta nunca la conoce.
  const temporal = generateTempPassword();
  let creado;
  try {
    creado = await withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, id_rol, estado, estado_cuenta, identidad_verificada,
                               debe_cambiar_contrasena, contrasena_temporal_expira)
         VALUES ($1, $2, $3, $4, $5, 3, 'APROBADO', 'Activo', true, true, NOW() + make_interval(hours => $6)) RETURNING id_usuario`,
        [nombre, apellido, correo, await hashPassword(temporal), telefono, HORAS_TEMPORAL]
      );
      // Si el correo no sale, el alta se revierte: nunca queda una cuenta cuya contraseña nadie conoce.
      await sendMail({
        to: correo,
        subject: 'Tu acceso al panel de administración - Click & Serve',
        html: tempPasswordEmailHtml({ nombre, password: temporal, horas: HORAS_TEMPORAL, url: process.env.PANEL_URL }),
        code: temporal,
      });
      return rows[0];
    });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'EMAIL_TAKEN', 'Ese correo ya está registrado.', { field: 'email' });
    if (error instanceof HttpError && error.status === 503) {
      return fail(res, 503, 'MAIL_UNAVAILABLE', 'No pudimos enviar el correo con la contraseña temporal, así que no se creó la cuenta. Intenta de nuevo en unos minutos.');
    }
    throw error;
  }
  audit(req, 'COADMIN_CREADO', 'usuario', creado.id_usuario, { correo });
  res.status(201).json({
    mensaje: `Coadministrador registrado. Enviamos una contraseña temporal a ${correo}: sirve para su primer acceso (vence en ${HORAS_TEMPORAL} horas) y deberá cambiarla al entrar.`,
    id_usuario: creado.id_usuario,
  });
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
  if (!req.body?.password || !(await verifyPassword(String(req.body.password), admin.contrasena))) {
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
