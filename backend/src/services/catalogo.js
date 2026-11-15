// Catálogo de servicios con precio base por servicio (anti-evasión).
// Click & Serve define los servicios de cada categoría con su rango y precio sugerido (panel de administración).
// Cada técnico fija su precio por servicio dentro del rango; sin precio propio se usa el sugerido. El precio que
// cuenta siempre se recorta al rango vigente, por si el administrador lo cambió después.
const { getPool } = require('../db/pool');
const { HttpError } = require('../lib/http');

const db = () => getPool();
// Un técnico cambia el precio de un servicio a lo más una vez cada 7 días (no lo sube justo antes de aceptar).
const DIAS_ENTRE_CAMBIOS = 7;

// Precio efectivo de un servicio para un técnico: el suyo o el sugerido, dentro del rango vigente.
// Espera los alias `srv` (servicios_catalogo) y `pt` (precios_tecnico, puede ser NULL).
const PRECIO_EFECTIVO = 'LEAST(srv.precio_max, GREATEST(srv.precio_min, COALESCE(pt.precio, srv.precio_sugerido)))';

const money = (v) => (v == null ? null : Number(v).toFixed(2));

function shapeServicio(r) {
  return {
    id_servicio: r.id_servicio,
    categoria: r.categoria,
    nombre: r.nombre,
    descripcion: r.descripcion,
    precio_min: money(r.precio_min),
    precio_max: money(r.precio_max),
    precio_sugerido: money(r.precio_sugerido),
    es_diagnostico: r.es_diagnostico === true,
    activo: r.activo !== false,
    orden: r.orden,
  };
}

async function listar({ incluirInactivos = false } = {}, q = db()) {
  const { rows } = await q.query(
    `SELECT * FROM servicios_catalogo srv WHERE ($1::boolean OR srv.activo) ORDER BY srv.categoria, srv.orden, srv.nombre`,
    [incluirInactivos]
  );
  return rows.map(shapeServicio);
}

async function obtener(idServicio, q = db()) {
  if (!Number.isInteger(Number(idServicio)) || Number(idServicio) <= 0) return null;
  const { rows } = await q.query('SELECT * FROM servicios_catalogo WHERE id_servicio = $1', [idServicio]);
  return rows[0] ? shapeServicio(rows[0]) : null;
}

// Precio base de un servicio para un técnico (al aceptar la solicitud).
async function precioDeServicio(idTecnico, idServicio, q = db()) {
  const { rows } = await q.query(
    `SELECT srv.nombre, ${PRECIO_EFECTIVO}::numeric(10,2)::text AS precio
     FROM servicios_catalogo srv LEFT JOIN precios_tecnico pt ON pt.id_servicio = srv.id_servicio AND pt.id_usuario = $1
     WHERE srv.id_servicio = $2`,
    [idTecnico, idServicio]
  );
  return rows[0] || null;
}

// Todos los precios efectivos de un técnico, para mostrar "Tu precio" en las solicitudes nuevas.
async function mapaPrecios(idTecnico, q = db()) {
  const { rows } = await q.query(
    `SELECT srv.id_servicio, ${PRECIO_EFECTIVO}::numeric(10,2)::text AS precio
     FROM servicios_catalogo srv LEFT JOIN precios_tecnico pt ON pt.id_servicio = srv.id_servicio AND pt.id_usuario = $1`,
    [idTecnico]
  );
  return new Map(rows.map((r) => [r.id_servicio, r.precio]));
}

// Lista de precios del técnico: los servicios de sus especialidades (todas las categorías si no registró ninguna).
async function preciosDelTecnico(idTecnico, q = db()) {
  const { rows } = await q.query(
    `SELECT srv.*, c.nombre AS categoria_nombre, pt.precio AS precio_propio, pt.fecha_actualizacion,
            ${PRECIO_EFECTIVO}::numeric(10,2)::text AS precio,
            CASE WHEN pt.fecha_actualizacion > NOW() - make_interval(days => $2::int)
                 THEN pt.fecha_actualizacion + make_interval(days => $2::int) END AS cambiar_desde
     FROM servicios_catalogo srv
     JOIN categorias_servicio c ON c.codigo = srv.categoria
     LEFT JOIN precios_tecnico pt ON pt.id_servicio = srv.id_servicio AND pt.id_usuario = $1
     WHERE srv.activo
       AND (NOT EXISTS (SELECT 1 FROM especialidades_tecnico e WHERE e.id_usuario = $1 AND e.categoria IS NOT NULL)
            OR srv.categoria IN (SELECT e.categoria FROM especialidades_tecnico e WHERE e.id_usuario = $1))
     ORDER BY c.orden, srv.orden, srv.nombre`,
    [idTecnico, DIAS_ENTRE_CAMBIOS]
  );
  return rows.map((r) => ({
    ...shapeServicio(r),
    categoria_nombre: r.categoria_nombre,
    precio: r.precio,
    precio_propio: money(r.precio_propio),
    cambiar_desde: r.cambiar_desde ? new Date(r.cambiar_desde).toISOString() : null,
  }));
}

async function fijarPrecio(idTecnico, idServicio, valor, q = db()) {
  const srv = await obtener(idServicio, q);
  if (!srv || !srv.activo) throw new HttpError(404, 'NOT_FOUND', 'Servicio no encontrado.');
  if (srv.es_diagnostico) throw new HttpError(409, 'FIXED_PRICE', 'La visita de diagnóstico tiene precio fijo para todos los técnicos.');
  const precio = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(precio) || Math.abs(Math.round(precio * 100) - precio * 100) > 1e-6
      || precio < Number(srv.precio_min) || precio > Number(srv.precio_max)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `El precio de "${srv.nombre}" debe estar entre $${srv.precio_min} y $${srv.precio_max}.`, { field: 'precio' });
  }
  const { rows: [actual] } = await q.query(
    `SELECT precio, fecha_actualizacion, fecha_actualizacion + make_interval(days => $3::int) AS desde
     FROM precios_tecnico WHERE id_usuario = $1 AND id_servicio = $2`,
    [idTecnico, idServicio, DIAS_ENTRE_CAMBIOS]
  );
  if (actual && Number(actual.precio) === precio) return { ...srv, precio: precio.toFixed(2), sin_cambio: true };
  if (actual && new Date(actual.desde) > new Date()) {
    const fecha = new Date(actual.desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' });
    throw new HttpError(409, 'PRICE_LOCKED', `Solo puedes cambiar este precio una vez por semana. Podrás cambiarlo de nuevo el ${fecha}.`, { cambiar_desde: new Date(actual.desde).toISOString() });
  }
  await q.query(
    `INSERT INTO precios_tecnico (id_usuario, id_servicio, precio) VALUES ($1, $2, $3::numeric)
     ON CONFLICT (id_usuario, id_servicio) DO UPDATE SET precio = EXCLUDED.precio, fecha_actualizacion = NOW()`,
    [idTecnico, idServicio, precio.toFixed(2)]
  );
  return { ...srv, precio: precio.toFixed(2) };
}

// ───────────── Administración del catálogo ─────────────
function leerServicio(b, actual = {}) {
  const v = {
    categoria: b.categoria !== undefined ? String(b.categoria).trim().toUpperCase() : actual.categoria,
    nombre: b.nombre !== undefined ? String(b.nombre).trim().replace(/\s+/g, ' ').slice(0, 80) : actual.nombre,
    descripcion: b.descripcion !== undefined ? (String(b.descripcion).trim().slice(0, 200) || null) : actual.descripcion,
    precio_min: b.precio_min !== undefined ? Number(b.precio_min) : Number(actual.precio_min),
    precio_max: b.precio_max !== undefined ? Number(b.precio_max) : Number(actual.precio_max),
    precio_sugerido: b.precio_sugerido !== undefined ? Number(b.precio_sugerido) : Number(actual.precio_sugerido),
    es_diagnostico: b.es_diagnostico !== undefined ? b.es_diagnostico === true : actual.es_diagnostico === true,
    activo: b.activo !== undefined ? b.activo === true : actual.activo !== false,
    orden: b.orden !== undefined ? Math.max(0, Math.min(999, Math.round(Number(b.orden) || 0))) : (actual.orden ?? 100),
  };
  if (!v.categoria) throw new HttpError(400, 'VALIDATION_ERROR', 'Elige la categoría del servicio.', { field: 'categoria' });
  if (!v.nombre || v.nombre.length < 3) throw new HttpError(400, 'VALIDATION_ERROR', 'Escribe el nombre del servicio (mínimo 3 letras).', { field: 'nombre' });
  for (const k of ['precio_min', 'precio_max', 'precio_sugerido']) {
    if (!Number.isFinite(v[k]) || v[k] <= 0 || v[k] > 100000) throw new HttpError(400, 'VALIDATION_ERROR', 'Los precios deben ser mayores a 0 y menores a $100,000.', { field: k });
  }
  // La visita de diagnóstico es precio fijo: el mismo mínimo, máximo y sugerido.
  if (v.es_diagnostico) { v.precio_min = v.precio_sugerido; v.precio_max = v.precio_sugerido; }
  if (!(v.precio_min <= v.precio_sugerido && v.precio_sugerido <= v.precio_max)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'El precio sugerido debe estar entre el mínimo y el máximo.', { field: 'precio_sugerido' });
  }
  return v;
}

async function crear(b, q = db()) {
  const v = leerServicio(b);
  const cat = await q.query('SELECT 1 FROM categorias_servicio WHERE codigo = $1', [v.categoria]);
  if (!cat.rowCount) throw new HttpError(400, 'VALIDATION_ERROR', 'La categoría no existe.', { field: 'categoria' });
  const { rows } = await q.query(
    `INSERT INTO servicios_catalogo (categoria, nombre, descripcion, precio_min, precio_max, precio_sugerido, es_diagnostico, activo, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (categoria, nombre) DO NOTHING RETURNING *`,
    [v.categoria, v.nombre, v.descripcion, v.precio_min, v.precio_max, v.precio_sugerido, v.es_diagnostico, v.activo, v.orden]
  );
  if (!rows[0]) throw new HttpError(409, 'DUPLICATE', 'Ya existe un servicio con ese nombre en la categoría.', { field: 'nombre' });
  return shapeServicio(rows[0]);
}

async function editar(idServicio, b, q = db()) {
  const { rows: [actual] } = await q.query('SELECT * FROM servicios_catalogo WHERE id_servicio = $1', [idServicio]);
  if (!actual) throw new HttpError(404, 'NOT_FOUND', 'Servicio no encontrado.');
  const v = leerServicio(b, actual);
  try {
    const { rows } = await q.query(
      `UPDATE servicios_catalogo SET categoria = $2, nombre = $3, descripcion = $4, precio_min = $5, precio_max = $6,
         precio_sugerido = $7, es_diagnostico = $8, activo = $9, orden = $10, fecha_actualizacion = NOW()
       WHERE id_servicio = $1 RETURNING *`,
      [idServicio, v.categoria, v.nombre, v.descripcion, v.precio_min, v.precio_max, v.precio_sugerido, v.es_diagnostico, v.activo, v.orden]
    );
    return shapeServicio(rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'DUPLICATE', 'Ya existe un servicio con ese nombre en la categoría.', { field: 'nombre' });
    throw error;
  }
}

module.exports = {
  DIAS_ENTRE_CAMBIOS, PRECIO_EFECTIVO, listar, obtener, precioDeServicio, mapaPrecios, preciosDelTecnico, fijarPrecio, crear, editar,
};
