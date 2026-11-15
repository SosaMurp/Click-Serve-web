const { getPool, withTransaction } = require('../db/pool');
const { haversineSql } = require('../lib/geo');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { getConfig } = require('./config');
const S = require('./solicitudes');

// Asignación de técnicos por proximidad (RF-47/48/49, RF-97).
// Un solo ranking para los recomendados y la búsqueda automática: técnicos en línea dentro del radio máximo,
// primero los de la especialidad, después el más cercano (Haversine) y después la mejor calificación.
// Los que tienen baja prioridad por una sanción de nivel 3 van al final.
// La búsqueda automática propone la solicitud a uno a la vez, en cascada, en vez de avisar a toda la ciudad.

// Centro de Lázaro Cárdenas cuando la solicitud no trae coordenadas (la distancia es solo orientativa).
const CENTRO = { latitud: 17.9583, longitud: -102.2 };

const DISTANCIA = haversineSql('u.latitud', 'u.longitud', '$1::numeric', '$2::numeric');
const ESPECIALIDAD = 'EXISTS (SELECT 1 FROM especialidades_tecnico e WHERE e.id_usuario = u.id_usuario AND e.categoria = $4 AND e.activa)';

// $1 lat, $2 lng, $3 id_solicitud, $4 categoría, $5 radio km, $6 excluir a quienes ya se les propuso, $7 límite.
const RANKING_SQL = `
  SELECT u.id_usuario, u.nombre, u.apellido, u.foto_archivo, COALESCE(u.verificado_sep, false) AS verificado_sep, u.bio,
         ROUND(${DISTANCIA}::numeric, 1) AS distancia_km,
         -- Posición aproximada (~1 km) para el mapa: la exacta solo se comparte con el técnico asignado en camino.
         ROUND(u.latitud::numeric, 2)::float AS latitud_aprox, ROUND(u.longitud::numeric, 2)::float AS longitud_aprox,
         (SELECT ROUND(AVG(q.puntuacion_tecnico)::numeric, 1) FROM calificaciones_servicio q WHERE q.id_tecnico = u.id_usuario AND q.puntuacion_tecnico IS NOT NULL) AS calificacion,
         (SELECT COUNT(*)::int FROM calificaciones_servicio q WHERE q.id_tecnico = u.id_usuario AND q.puntuacion_tecnico IS NOT NULL) AS resenas,
         (SELECT COUNT(*)::int FROM solicitudes_servicio f WHERE f.id_tecnico = u.id_usuario AND f.estado = 'FINALIZADA') AS trabajos,
         (SELECT array_agg(c.nombre ORDER BY c.orden) FROM especialidades_tecnico e JOIN categorias_servicio c ON c.codigo = e.categoria
           WHERE e.id_usuario = u.id_usuario AND e.activa) AS especialidades,
         -- Precio base que cobraría este técnico (lo paga el cliente al aceptar): por el servicio del catálogo
         -- que pidió el cliente; sin servicio, por la categoría.
         COALESCE(
           (SELECT LEAST(srv.precio_max, GREATEST(srv.precio_min, COALESCE(pt.precio, srv.precio_sugerido)))::numeric(10,2)::text
              FROM servicios_catalogo srv LEFT JOIN precios_tecnico pt ON pt.id_servicio = srv.id_servicio AND pt.id_usuario = u.id_usuario
             WHERE srv.id_servicio = $8::int),
           (SELECT COALESCE(e.precio_base, NULLIF(c.tarifa_base, 0), c.precio_min)::numeric(10,2)::text
              FROM categorias_servicio c LEFT JOIN especialidades_tecnico e ON e.categoria = c.codigo AND e.id_usuario = u.id_usuario
             WHERE c.codigo = $4::text)) AS precio_base
  FROM usuarios u
  WHERE u.id_rol = 2 AND u.anonimizado = false AND u.identidad_verificada = true
    AND UPPER(COALESCE(u.estado_cuenta, '')) IN ('ACTIVO', 'APROBADO')
    AND u.disponible = true AND u.ultimo_latido > NOW() - INTERVAL '90 seconds' AND u.latitud IS NOT NULL
    -- Escala de sanciones: suspendidos (nivel 2 y 3) o baneados no reciben trabajos.
    AND u.baneado = false AND (u.suspendido_hasta IS NULL OR u.suspendido_hasta <= NOW())
    AND ${DISTANCIA} <= $5::numeric
    AND NOT EXISTS (SELECT 1 FROM solicitudes_descartadas d WHERE d.id_solicitud = $3 AND d.id_tecnico = u.id_usuario)
    AND NOT ($6::boolean AND EXISTS (SELECT 1 FROM intentos_asignacion i WHERE i.id_solicitud = $3 AND i.id_tecnico = u.id_usuario))
    AND ($4::text IS NULL
         OR NOT EXISTS (SELECT 1 FROM especialidades_tecnico e WHERE e.id_usuario = u.id_usuario AND e.categoria IS NOT NULL)
         OR ${ESPECIALIDAD})
  -- Nivel 3 de la escala de sanciones: con baja prioridad va después de todos los demás.
  ORDER BY COALESCE(u.prioridad_baja_hasta > NOW(), false) ASC, ${ESPECIALIDAD} DESC, distancia_km ASC, calificacion DESC NULLS LAST, u.id_usuario
  LIMIT $7`;

function origen(row) {
  return row.latitud != null && row.longitud != null
    ? { latitud: Number(row.latitud), longitud: Number(row.longitud) }
    : CENTRO;
}

async function rankTecnicos(row, { excluirIntentados = false, limit = 10, db = getPool() } = {}) {
  const { radio_maximo_km: radio } = await getConfig();
  const o = origen(row);
  const { rows } = await db.query(RANKING_SQL, [o.latitud, o.longitud, row.id_solicitud, row.categoria, Number(radio), excluirIntentados, limit, row.id_servicio ?? null]);
  return rows;
}

// El técnico está dentro del radio de la solicitud. Sin coordenadas en la solicitud no se puede medir: se permite.
// Sin ubicación del técnico, no.
async function dentroDeRadio(idTecnico, row, db = getPool()) {
  if (row.latitud == null || row.longitud == null) return true;
  const { radio_maximo_km: radio } = await getConfig();
  const { rows } = await db.query(
    `SELECT ${haversineSql('latitud', 'longitud', '$2::numeric', '$3::numeric')} <= $4::numeric AS dentro
     FROM usuarios WHERE id_usuario = $1 AND latitud IS NOT NULL`,
    [idTecnico, row.latitud, row.longitud, Number(radio)]
  );
  return rows[0]?.dentro === true;
}

// Aviso abierto a los técnicos en línea de la especialidad que estén dentro del radio (no a toda la ciudad).
async function notificarCercanos(row) {
  try {
    const ids = (await rankTecnicos(row, { limit: 50 })).map((t) => t.id_usuario);
    realtime.emitToUsers(ids, 'solicitud.nueva', { id_solicitud: Number(row.id_solicitud), categoria: row.categoria });
  } catch (error) {
    console.error('No se pudo avisar a los técnicos cercanos:', error.message);
  }
}

// Propone la solicitud al siguiente técnico más cercano que no la haya tenido. Lo llaman la búsqueda automática,
// el barrido de propuestas vencidas, el descarte del técnico propuesto y la cancelación de un técnico.
// inicial: el cliente acaba de pedirla (si no hay nadie cerca se le avisa).
async function proponerSiguiente(idSolicitud, { inicial = false } = {}) {
  const out = await withTransaction(async (tx) => {
    const row = await S.findRow(idSolicitud, tx, { lock: true });
    if (!row || row.estado !== 'PENDIENTE' || row.modo_asignacion !== 'AUTOMATICA') return null;
    const vigente = row.id_tecnico_propuesto && row.propuesto_hasta && new Date(row.propuesto_hasta) > new Date();
    if (vigente) return null;
    if (row.id_tecnico_propuesto) {
      await tx.query(
        "UPDATE intentos_asignacion SET resultado = 'VENCIDA' WHERE id_solicitud = $1 AND id_tecnico = $2 AND resultado = 'PROPUESTA'",
        [row.id_solicitud, row.id_tecnico_propuesto]
      );
    }
    const [siguiente] = await rankTecnicos(row, { excluirIntentados: true, limit: 1, db: tx });
    if (!siguiente) {
      await tx.query('UPDATE solicitudes_servicio SET id_tecnico_propuesto = NULL, propuesto_hasta = NULL WHERE id_solicitud = $1', [row.id_solicitud]);
      return { row, siguiente: null, habiaPropuesta: !!row.id_tecnico_propuesto };
    }
    const { tolerancia_minutos: minutos } = await getConfig();
    await tx.query(
      'UPDATE solicitudes_servicio SET id_tecnico_propuesto = $1, propuesto_hasta = NOW() + make_interval(mins => $3) WHERE id_solicitud = $2',
      [siguiente.id_usuario, row.id_solicitud, Number(minutos) || 10]
    );
    await tx.query(
      `INSERT INTO intentos_asignacion (id_solicitud, id_tecnico, distancia_km) VALUES ($1, $2, $3)
       ON CONFLICT (id_solicitud, id_tecnico) DO UPDATE SET resultado = 'PROPUESTA', fecha = NOW(), distancia_km = EXCLUDED.distancia_km`,
      [row.id_solicitud, siguiente.id_usuario, siguiente.distancia_km]
    );
    return { row: await S.findRow(row.id_solicitud, tx), siguiente, minutos: Number(minutos) || 10 };
  });
  if (!out) return null;

  const id = Number(out.row.id_solicitud);
  if (out.siguiente) {
    const t = out.siguiente;
    realtime.emitToUser(t.id_usuario, 'solicitud.propuesta', { id_solicitud: id });
    sendPush(t.id_usuario, 'Tienes un trabajo cerca', `${out.row.categoria_nombre || 'Servicio'} a ${t.distancia_km} km: revisa la solicitud ${out.row.folio}.`, { id_solicitud: id });
    realtime.emitToUser(out.row.id_usuario, 'solicitud.actualizada', {
      id_solicitud: id, estado: 'PENDIENTE',
      aviso: `Le propusimos tu solicitud a ${t.nombre}, el técnico disponible más cercano (a ${t.distancia_km} km). Tiene ${out.minutos} minutos para aceptar.`,
    });
  } else {
    // Nadie más dentro del radio: queda abierta para los técnicos cercanos que se conecten.
    await notificarCercanos(out.row);
    if (inicial || out.habiaPropuesta) {
      realtime.emitToUser(out.row.id_usuario, 'solicitud.actualizada', {
        id_solicitud: id, estado: 'PENDIENTE',
        aviso: 'Por ahora no hay técnicos disponibles cerca. Avisaremos a los que se conecten en tu zona.',
      });
    }
  }
  return out;
}

// Barrido periódico: propuestas vencidas y búsquedas automáticas que se quedaron sin técnico.
async function barrerAsignaciones() {
  const { rows } = await getPool().query(
    `SELECT id_solicitud FROM solicitudes_servicio
     WHERE estado = 'PENDIENTE' AND modo_asignacion = 'AUTOMATICA'
       AND (id_tecnico_propuesto IS NULL OR propuesto_hasta < NOW())
     ORDER BY fecha_creacion LIMIT 50`
  );
  for (const r of rows) {
    await proponerSiguiente(r.id_solicitud).catch((error) => console.error(`Asignación de ${r.id_solicitud}:`, error.message));
  }
  return rows.length;
}

module.exports = { rankTecnicos, dentroDeRadio, notificarCercanos, proponerSiguiente, barrerAsignaciones };
