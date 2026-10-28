// controllers/dashboardController.js
const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/dashboard/stats
// KPIs consolidados: técnicos, servicios, validaciones pendientes, ingresos.
// Usa subconsultas para evitar múltiples roundtrips al cliente.
// ══════════════════════════════════════════════════════════════════════════════
exports.getStats = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH
        -- Técnicos con sesión activa (sesiones no revocadas)
        tecnicos_online AS (
          SELECT COUNT(DISTINCT sa.id_usuario) AS n
          FROM sesiones_activas sa
          JOIN Usuarios u ON sa.id_usuario = u.id_usuario
          WHERE sa.estado = 'activa'
            AND u.id_rol = 2
            AND u.estado_cuenta = 'Activo'
        ),
        -- Técnicos online la semana pasada (para variación %)
        tecnicos_online_prev AS (
          SELECT COUNT(DISTINCT sa.id_usuario) AS n
          FROM sesiones_activas sa
          JOIN Usuarios u ON sa.id_usuario = u.id_usuario
          WHERE sa.estado = 'activa'
            AND u.id_rol = 2
            AND u.estado_cuenta = 'Activo'
            AND sa.fecha_creacion < NOW() - INTERVAL '7 days'
        ),
        -- Servicios en curso
        en_curso AS (
          SELECT COUNT(*) AS n FROM servicios WHERE estatus = 'En Curso'
        ),
        -- Expedientes pendientes de validación
        validaciones AS (
          SELECT COUNT(*) AS n
          FROM expedientes_tecnicos
          WHERE estatus IN ('En Revisión', 'Pendiente')
        ),
        -- Ingresos de hoy (pagos confirmados)
        ingresos_hoy AS (
          SELECT COALESCE(SUM(monto), 0) AS total
          FROM pagos
          WHERE estado = 'Confirmado'
            AND DATE(fecha_pago) = CURRENT_DATE
        ),
        -- Ingresos de ayer
        ingresos_ayer AS (
          SELECT COALESCE(SUM(monto), 0) AS total
          FROM pagos
          WHERE estado = 'Confirmado'
            AND DATE(fecha_pago) = CURRENT_DATE - 1
        ),
        -- Servicios completados este mes
        completados_mes AS (
          SELECT COUNT(*) AS n
          FROM servicios
          WHERE estatus = 'Completado'
            AND DATE_TRUNC('month', fecha_creacion) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        -- Total de clientes
        total_clientes AS (
          SELECT COUNT(*) AS n FROM Usuarios WHERE id_rol = 1
        )
      SELECT
        (SELECT n   FROM tecnicos_online)::int            AS tecnicos_online,
        (SELECT n   FROM en_curso)::int                   AS servicios_en_curso,
        (SELECT n   FROM validaciones)::int               AS validaciones_pendientes,
        (SELECT total FROM ingresos_hoy)::numeric         AS ingresos_hoy,
        (SELECT n   FROM completados_mes)::int            AS servicios_completados_mes,
        (SELECT n   FROM total_clientes)::int             AS total_clientes,
        -- Variación % técnicos online vs semana anterior
        CASE
          WHEN (SELECT n FROM tecnicos_online_prev) = 0 THEN NULL
          ELSE ROUND(
            ((SELECT n FROM tecnicos_online)::numeric - (SELECT n FROM tecnicos_online_prev)) /
            (SELECT n FROM tecnicos_online_prev) * 100, 1
          )
        END AS variacion_tecnicos_pct,
        -- Variación % ingresos hoy vs ayer
        CASE
          WHEN (SELECT total FROM ingresos_ayer) = 0 THEN NULL
          ELSE ROUND(
            ((SELECT total FROM ingresos_hoy) - (SELECT total FROM ingresos_ayer)) /
            (SELECT total FROM ingresos_ayer) * 100, 1
          )
        END AS variacion_ingresos_pct
    `);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error en getStats:', error);
    res.status(500).json({ error: 'Error al consolidar las estadísticas del dashboard.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/dashboard/servicios-mes
// Serie de tiempo: servicios agrupados por día en los últimos 30 días.
// Usa GENERATE_SERIES para rellenar días sin actividad con 0.
// ══════════════════════════════════════════════════════════════════════════════
exports.getServiciosMes = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH
        rango AS (
          SELECT GENERATE_SERIES(
            CURRENT_DATE - INTERVAL '29 days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS fecha
        ),
        datos AS (
          SELECT
            DATE(fecha_creacion) AS fecha,
            COUNT(*) FILTER (WHERE estatus = 'Completado') AS completados,
            COUNT(*) FILTER (WHERE estatus = 'Cancelado')  AS cancelados,
            COUNT(*) FILTER (WHERE estatus = 'En Curso')   AS en_curso
          FROM servicios
          WHERE fecha_creacion >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY DATE(fecha_creacion)
        )
      SELECT
        r.fecha,
        TO_CHAR(r.fecha, 'DD Mon') AS dia,
        COALESCE(d.completados, 0)::int AS completados,
        COALESCE(d.cancelados,  0)::int AS cancelados,
        COALESCE(d.en_curso,    0)::int AS en_curso
      FROM rango r
      LEFT JOIN datos d ON d.fecha = r.fecha
      ORDER BY r.fecha ASC
    `);
    const puntos = result.rows;
    const total_completados = puntos.reduce((s, r) => s + r.completados, 0);
    const total_cancelados  = puntos.reduce((s, r) => s + r.cancelados,  0);
    res.status(200).json({ puntos, total_completados, total_cancelados });
  } catch (error) {
    console.error('Error en getServiciosMes:', error);
    res.status(500).json({ error: 'Error al obtener la serie de servicios del mes.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/dashboard/recent-services?limit=8
// Últimos N servicios con JOIN a técnico y cliente.
// ══════════════════════════════════════════════════════════════════════════════
exports.getRecentServices = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? '8', 10), 50);
    const result = await pool.query(`
      SELECT
        s.id_servicio,
        CONCAT('SRV-', LPAD(s.id_servicio::text, 3, '0')) AS codigo,
        s.titulo,
        s.estatus,
        s.monto,
        s.direccion,
        s.fecha_creacion,
        -- Técnico asignado (puede ser NULL si aún no se asignó)
        t.nombre  AS tecnico_nombre,
        t.apellido AS tecnico_apellido,
        -- Cliente que solicitó el servicio
        c.nombre  AS cliente_nombre,
        c.apellido AS cliente_apellido
      FROM servicios s
      LEFT JOIN Usuarios t ON s.id_tecnico  = t.id_usuario
      LEFT JOIN Usuarios c ON s.id_cliente  = c.id_usuario
      ORDER BY s.fecha_creacion DESC
      LIMIT $1
    `, [limit]);
    res.status(200).json({
      servicios: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    console.error('Error en getRecentServices:', error);
    res.status(500).json({ error: 'Error al obtener los servicios recientes.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/dashboard/actividad
// Feed de actividad reciente del sistema (últimas 20 entradas).
// ══════════════════════════════════════════════════════════════════════════════
exports.getActividad = async (req, res) => {
  try {
    // Si tienes una tabla \`actividad_log\`, úsala aquí.
    // Como alternativa, construimos el feed desde servicios + expedientes + pagos.
    const result = await pool.query(`
      (
        SELECT
          s.id_servicio          AS id,
          'servicio'             AS tipo,
          CONCAT(
            CASE s.estatus
              WHEN 'Completado' THEN 'Servicio completado: '
              WHEN 'Cancelado'  THEN 'Servicio cancelado: '
              WHEN 'En Curso'   THEN 'Servicio iniciado: '
              ELSE 'Nuevo servicio: '
            END,
            s.titulo
          )                      AS descripcion,
          s.direccion            AS sub,
          s.fecha_creacion       AS creado_en,
          (s.estatus = 'Cancelado') AS urgente
        FROM servicios s
        ORDER BY s.fecha_creacion DESC
        LIMIT 8
      )
      UNION ALL
      (
        SELECT
          et.id_expediente       AS id,
          'tecnico'              AS tipo,
          CONCAT('Nuevo técnico registrado: ', u.nombre, ' ', u.apellido) AS descripcion,
          et.especialidad        AS sub,
          et.fecha_solicitud     AS creado_en,
          (et.estatus = 'Pendiente') AS urgente
        FROM expedientes_tecnicos et
        JOIN Usuarios u ON u.id_usuario = et.id_usuario
        ORDER BY et.fecha_solicitud DESC
        LIMIT 5
      )
      ORDER BY creado_en DESC
      LIMIT 20
    `);
    res.status(200).json({ items: result.rows });
  } catch (error) {
    console.error('Error en getActividad:', error);
    res.status(500).json({ error: 'Error al obtener el feed de actividad.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/dashboard/especialidades
// Distribución de servicios completados por especialidad del técnico.
// ══════════════════════════════════════════════════════════════════════════════
exports.getEspecialidades = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(et.especialidad, 'Sin especialidad') AS especialidad,
        COUNT(s.id_servicio)::int                     AS total,
        ROUND(
          COUNT(s.id_servicio)::numeric /
          NULLIF(SUM(COUNT(s.id_servicio)) OVER (), 0) * 100, 1
        )                                             AS porcentaje
      FROM servicios s
      LEFT JOIN Usuarios t        ON s.id_tecnico = t.id_usuario
      LEFT JOIN expedientes_tecnicos et ON et.id_usuario = t.id_usuario
      WHERE s.estatus = 'Completado'
        AND s.fecha_creacion >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY et.especialidad
      ORDER BY total DESC
      LIMIT 8
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error en getEspecialidades:', error);
    res.status(500).json({ error: 'Error al obtener la distribución por especialidad.' });
  }
};
