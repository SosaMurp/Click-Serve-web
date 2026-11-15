const { randomUUID } = require('crypto');
const express = require('express');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole, requireApproved } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { idempotent } = require('../lib/idempotency');
const { sanitizeText } = require('../lib/sanitize');
const { saveFile, uploader, signFileUrl, verifyRequestImageSignature, DOCUMENT_TYPES } = require('../lib/files');
const { parseCoord, haversineSql } = require('../lib/geo');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { chargeCard } = require('../services/payments');
const S = require('../services/solicitudes');
const { nowMx } = require('../lib/dates');
const { getConfig } = require('../services/config');
const asignacion = require('../services/asignacion');
const sanciones = require('../services/sanciones');
const { filtroChatSeguro } = require('../middleware/chatFilter');
const { custodiaRetenida, marcarReembolso, liberar: liberarCustodia } = require('../services/custodia');
const precioBase = require('../services/precioBase');
const catalogo = require('../services/catalogo');
const stripePagos = require('../services/stripe');
const { VERSION: POLITICAS_VERSION, TIPO: TIPO_CHAT, politicasAceptadas, aceptarPoliticas, exigirPoliticas } = require('../services/chatPoliticas');

const router = express.Router();
const db = () => getPool();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function loadOr404(id, user, options) {
  const row = await S.findRow(id, options?.db, options);
  if (!S.canView(row, user)) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
  return row;
}

async function resolveCategory(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw || raw === 'OTROS' || raw === 'GENERAL') return null;
  const code = S.LEGACY_CATEGORIES[raw] || raw;
  const { rows } = await db().query('SELECT codigo FROM categorias_servicio WHERE codigo = $1', [code]);
  if (!rows[0]) throw new HttpError(400, 'VALIDATION_ERROR', 'La categoría seleccionada no existe.', { field: 'categoria' });
  return code;
}

router.get('/api/categorias', async (_req, res) => {
  const { rows } = await db().query('SELECT codigo, nombre, descripcion, icono, precio_min, precio_max, tarifa_base AS precio_sugerido FROM categorias_servicio ORDER BY orden, nombre');
  // Catálogo de servicios por categoría (precio base por servicio).
  const servicios = await catalogo.listar();
  res.json({ categorias: rows.map((c) => ({ ...c, servicios: servicios.filter((s) => s.categoria === c.codigo) })) });
});

// ───────────────────────── Crear y consultar ─────────────────────────
router.post(
  '/api/solicitudes',
  auth, requireRole(ROL.CLIENTE), requireApproved, sanciones.noSuspendido,
  uploader({ maxFiles: 5 }).array('imagenes', 5),
  idempotent('solicitud.crear'),
  async (req, res) => {
    const b = req.body || {};
    const descripcion = sanitizeText(b.descripcion, 1000);
    const direccion = sanitizeText(b.direccion, 300);
    if (descripcion.length < 10) return fail(res, 400, 'VALIDATION_ERROR', 'Describe el problema con al menos 10 caracteres.', { field: 'descripcion' });
    if (direccion.length < 5) return fail(res, 400, 'VALIDATION_ERROR', 'Indica la dirección del servicio.', { field: 'direccion' });
    let categoria = await resolveCategory(b.categoria);
    // Servicio del catálogo (opcional en la app anterior): define la categoría y el precio base.
    let idServicio = null;
    if (b.id_servicio !== undefined && b.id_servicio !== null && b.id_servicio !== '') {
      const srv = await catalogo.obtener(b.id_servicio);
      if (!srv || !srv.activo) return fail(res, 400, 'VALIDATION_ERROR', 'El servicio elegido ya no está disponible.', { field: 'id_servicio' });
      if (categoria && srv.categoria !== categoria) return fail(res, 400, 'VALIDATION_ERROR', 'El servicio no pertenece a la categoría elegida.', { field: 'id_servicio' });
      categoria = srv.categoria;
      idServicio = srv.id_servicio;
    }

    const ahora = nowMx();
    const fecha = b.fecha_preferida ? String(b.fecha_preferida) : null;
    if (fecha && (!ISO_DATE.test(fecha) || fecha < ahora.fecha)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Elige una fecha de hoy en adelante.', { field: 'fecha_preferida' });
    }
    const hora = b.hora_preferida ? String(b.hora_preferida).slice(0, 5) : null;
    if (hora && !HHMM.test(hora)) return fail(res, 400, 'VALIDATION_ERROR', 'Elige una hora válida.', { field: 'hora_preferida' });
    if (hora && fecha === ahora.fecha && hora < ahora.hora) return fail(res, 400, 'VALIDATION_ERROR', 'Esa hora ya pasó. Elige una más tarde.', { field: 'hora_preferida' });
    const lat = parseCoord(b.latitud, -90, 90);
    const lng = parseCoord(b.longitud, -180, 180);

    const created = await withTransaction(async (tx) => {
      // Si el folio aleatorio ya existe se genera otro; ON CONFLICT evita abortar la transacción.
      let row;
      for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
        const r = await tx.query(
          `INSERT INTO solicitudes_servicio (folio, id_usuario, categoria, descripcion, direccion, referencias,
                                             fecha_preferida, hora_preferida, estado, latitud, longitud, estado_pago, id_servicio)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDIENTE', $9, $10, 'PENDIENTE', $11)
           ON CONFLICT (folio) DO NOTHING RETURNING id_solicitud`,
          [S.folio('SRV'), req.user.id_usuario, categoria, descripcion, direccion, sanitizeText(b.referencias, 300) || null, fecha, hora, lat, lng, idServicio]
        );
        row = r.rows[0];
      }
      if (!row) throw new Error('No se pudo generar un folio único para la solicitud');
      for (const image of req.files || []) {
        await tx.query(
          'INSERT INTO solicitud_imagenes (id_solicitud, nombre, tipo_mime, contenido) VALUES ($1, $2, $3, $4)',
          [row.id_solicitud, image.originalname, image.mimetype, image.buffer]
        );
      }
      return S.findRow(row.id_solicitud, tx);
    });

    audit(req, 'SOLICITUD_CREADA', 'solicitud', created.id_solicitud);
    notifyAvailableTechs(created);
    return res.status(201).json({ mensaje: 'Solicitud creada.', solicitud: S.shape(created, req.user), folio: created.folio });
  }
);

// Aviso en tiempo real a técnicos disponibles con la especialidad y dentro del radio máximo de la solicitud.
const notifyAvailableTechs = (row) => asignacion.notificarCercanos(row);

// Cuando la solicitud vuelve a quedar libre: en modo automático se propone al siguiente más cercano;
// en modo manual se avisa a los técnicos cercanos y el cliente puede elegir.
function reasignar(row) {
  if (row.modo_asignacion === 'AUTOMATICA') {
    asignacion.proponerSiguiente(row.id_solicitud).catch((error) => console.error('No se pudo proponer al siguiente técnico:', error.message));
  } else {
    notifyAvailableTechs(row);
  }
}

router.get('/api/solicitudes/cliente', auth, async (req, res) => {
  const { rows } = await db().query(`${S.BASE_SELECT} WHERE s.id_usuario = $1 ORDER BY s.fecha_creacion DESC`, [req.user.id_usuario]);
  res.json({ solicitudes: rows.map((r) => S.shape(r, req.user)) });
});

router.get('/api/solicitudes/tecnico', auth, requireRole(ROL.TECNICO), async (req, res) => {
  const me = req.user.id_usuario;
  const vista = String(req.query.vista || '');
  const loc = (await db().query('SELECT latitud, longitud FROM usuarios WHERE id_usuario = $1', [me])).rows[0] || {};
  const distance = loc.latitud != null
    ? `ROUND(${haversineSql('s.latitud', 's.longitud', '$2::numeric', '$3::numeric')}::numeric, 1)`
    : 'NULL::numeric';
  const params = loc.latitud != null ? [me, loc.latitud, loc.longitud] : [me];

  const nuevasWhere = S.nuevasWhere(req.user.aprobado);
  const enCursoWhere = S.TECH_WHERE.en_curso;
  const historialWhere = S.TECH_WHERE.historial;
  const contadores = await S.techCounters(me, undefined, { aprobado: req.user.aprobado });

  let where;
  let order;
  if (vista === 'nuevas') {
    where = nuevasWhere;
    order = `(s.id_tecnico_propuesto = $1 AND s.propuesto_hasta > NOW()) DESC NULLS LAST, distancia_km ASC NULLS LAST, s.fecha_creacion DESC`;
  } else if (vista === 'en_curso') {
    where = enCursoWhere;
    order = 's.fecha_preferida ASC NULLS LAST, s.fecha_creacion DESC';
  } else if (vista === 'historial') {
    where = historialWhere;
    order = 'COALESCE(s.fecha_finalizacion, s.fecha_creacion) DESC';
  } else {
    where = `(${nuevasWhere}) OR (${enCursoWhere}) OR (s.id_tecnico = $1 AND s.estado = 'FINALIZADA')`;
    order = 's.fecha_creacion DESC';
  }

  const { rows } = await db().query(
    `SELECT * FROM (SELECT base.*, ${distance.replace(/s\./g, 'base.')} AS distancia_km FROM (${S.BASE_SELECT}) base) s
     WHERE ${where} ORDER BY ${order} LIMIT 100`,
    params
  );
  // Precio base: en las nuevas el técnico ve lo que cobrará al aceptar (su precio para esa categoría).
  const miPrecio = await precioBase.preciosDelTecnico(me);
  res.json({
    solicitudes: rows.map((r) => S.shape(r, req.user, {
      distancia_km: r.distancia_km == null ? null : Number(r.distancia_km),
      propuesta_a_mi: r.id_tecnico_propuesto === me && new Date(r.propuesto_hasta) > new Date(),
      ...(r.estado === 'PENDIENTE' ? { mi_precio: miPrecio(r.categoria, r.id_servicio) } : {}),
    })),
    contadores,
  });
});

router.get('/api/solicitudes/:id', auth, async (req, res) => {
  const row = await loadOr404(req.params.id, req.user);
  res.json({ solicitud: await S.detail(row, req.user) });
});

// Foto de la solicitud con URL firmada (para <Image>, que no puede mandar la cabecera de sesión).
router.get('/api/solicitudes/imagenes/:idImagen', async (req, res) => {
  const id = Number(req.params.idImagen);
  if (!Number.isInteger(id) || !verifyRequestImageSignature(id, req.query.exp, req.query.sig)) {
    return fail(res, 403, 'FILE_LINK_EXPIRED', 'El enlace de la imagen venció. Vuelve a abrirla desde la app.');
  }
  const { rows } = await db().query('SELECT tipo_mime, contenido FROM solicitud_imagenes WHERE id_imagen = $1', [id]);
  if (!rows[0]) return fail(res, 404, 'NOT_FOUND', 'Imagen no encontrada.');
  res.set('Cache-Control', 'private, max-age=300');
  return res.type(rows[0].tipo_mime).send(rows[0].contenido);
});

router.get('/api/solicitudes/:id/imagenes/:idImagen', auth, async (req, res) => {
  const row = await loadOr404(req.params.id, req.user);
  const { rows } = await db().query(
    'SELECT tipo_mime, contenido FROM solicitud_imagenes WHERE id_imagen = $1 AND id_solicitud = $2',
    [req.params.idImagen, row.id_solicitud]
  );
  if (!rows[0]) return fail(res, 404, 'NOT_FOUND', 'Imagen no encontrada.');
  res.set('Cache-Control', 'private, max-age=300');
  return res.type(rows[0].tipo_mime).send(rows[0].contenido);
});

// ───────────────────────── Elección de técnico (RF-47/48/49) ─────────────────────────
router.get('/api/tecnicos/recomendados', auth, async (req, res) => {
  const row = await loadOr404(req.query.id_solicitud, req.user);
  if (row.id_usuario !== req.user.id_usuario) return fail(res, 404, 'NOT_FOUND', 'Solicitud no encontrada.');
  // Mismo ranking que la búsqueda automática: radio máximo, especialidad, cercanía y calificación.
  const rows = await asignacion.rankTecnicos(row);
  res.json({
    tecnicos: rows.map((t) => ({
      ...t,
      foto_url: t.foto_archivo ? signFileUrl(t.foto_archivo) : null,
      foto_archivo: undefined,
      distancia_km: t.distancia_km == null ? null : Number(t.distancia_km),
      eta_min: t.distancia_km == null ? null : Math.max(1, Math.round((Number(t.distancia_km) / 25) * 60)),
      especialidades: t.especialidades || [],
      precio_base: t.precio_base || precioBase.DIAGNOSTICO.precio,
    })),
  });
});

router.post('/api/solicitudes/:id/proponer-tecnico', auth, requireRole(ROL.CLIENTE), sanciones.noSuspendido, async (req, res) => {
  const idTecnico = Number(req.body?.id_tecnico);
  const result = await withTransaction(async (tx) => {
    const row = await loadOr404(req.params.id, req.user, { db: tx, lock: true });
    if (row.id_usuario !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (row.estado !== 'PENDIENTE') throw new HttpError(409, 'INVALID_STATE', 'La solicitud ya tiene técnico asignado.');
    const tech = await tx.query(
      `SELECT id_usuario FROM usuarios WHERE id_usuario = $1 AND id_rol = 2 AND disponible = true AND identidad_verificada = true
         AND anonimizado = false AND UPPER(COALESCE(estado_cuenta, '')) IN ('ACTIVO', 'APROBADO')
         AND ultimo_latido > NOW() - INTERVAL '90 seconds'`,
      [idTecnico]
    );
    if (!tech.rows[0]) throw new HttpError(409, 'TECH_UNAVAILABLE', 'Este técnico ya no está disponible. Elige otro o usa la búsqueda automática.');
    if (!(await asignacion.dentroDeRadio(idTecnico, row, tx))) {
      throw new HttpError(409, 'OUT_OF_RANGE', 'Este técnico está fuera de la zona de servicio de tu domicilio. Elige uno más cercano.');
    }
    await tx.query(
      "UPDATE solicitudes_servicio SET id_tecnico_propuesto = $1, propuesto_hasta = NOW() + make_interval(mins => $3), modo_asignacion = 'MANUAL' WHERE id_solicitud = $2",
      [idTecnico, row.id_solicitud, Number((await getConfig()).tolerancia_minutos) || 10]
    );
    return S.findRow(row.id_solicitud, tx);
  });
  realtime.emitToUser(idTecnico, 'solicitud.propuesta', { id_solicitud: Number(result.id_solicitud) });
  sendPush(idTecnico, 'Un cliente te eligió', `${result.categoria_nombre || 'Servicio'}: revisa la solicitud ${result.folio}.`, { id_solicitud: Number(result.id_solicitud) });
  res.json({ mensaje: `Enviamos la solicitud al técnico. Tiene ${(await getConfig()).tolerancia_minutos} minutos para responder.`, solicitud: S.shape(result, req.user) });
});

router.post('/api/solicitudes/:id/busqueda-automatica', auth, requireRole(ROL.CLIENTE), sanciones.noSuspendido, async (req, res) => {
  const row = await loadOr404(req.params.id, req.user);
  if (row.id_usuario !== req.user.id_usuario) return fail(res, 404, 'NOT_FOUND', 'Solicitud no encontrada.');
  if (row.estado !== 'PENDIENTE') return fail(res, 409, 'INVALID_STATE', 'La solicitud ya tiene técnico asignado.');
  // Propuesta en cascada: al más cercano primero; si no acepta a tiempo o la descarta, al siguiente.
  await db().query(
    "UPDATE solicitudes_servicio SET modo_asignacion = 'AUTOMATICA', id_tecnico_propuesto = NULL, propuesto_hasta = NULL WHERE id_solicitud = $1",
    [row.id_solicitud]
  );
  const out = await asignacion.proponerSiguiente(row.id_solicitud, { inicial: true });
  const fresh = await S.findRow(row.id_solicitud);
  const t = out?.siguiente;
  const mensaje = t
    ? `Le propusimos tu solicitud a ${t.nombre}, el técnico disponible más cercano (a ${t.distancia_km} km). Si no acepta a tiempo, pasamos al siguiente.`
    : 'Por ahora no hay técnicos disponibles cerca. Avisaremos a los que se conecten en tu zona.';
  res.json({ mensaje, solicitud: S.shape(fresh, req.user) });
});

// ───────────────────────── Aceptar / descartar (RF-58) ─────────────────────────
async function acceptRequest(req, res) {
  const me = req.user.id_usuario;
  // Escala de sanciones: suspendido (nivel 2 o 3) no acepta trabajos nuevos.
  await sanciones.exigirNoSuspendido(me);
  const row = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    const available = current && current.estado === 'PENDIENTE'
      && (!current.id_tecnico_propuesto || current.id_tecnico_propuesto === me || new Date(current.propuesto_hasta) < new Date());
    const discarded = current && (await tx.query('SELECT 1 FROM solicitudes_descartadas WHERE id_solicitud = $1 AND id_tecnico = $2', [current.id_solicitud, me])).rowCount > 0;
    if (!available || discarded) throw new HttpError(409, 'NOT_AVAILABLE', 'La solicitud ya no está disponible.');
    // Quien no recibió la propuesta solo la toma si está dentro del radio de servicio del domicilio.
    if (current.id_tecnico_propuesto !== me && !(await asignacion.dentroDeRadio(me, current, tx))) {
      throw new HttpError(409, 'OUT_OF_RANGE', 'Esta solicitud está fuera de tu zona de servicio. Activa tu ubicación o busca trabajos más cercanos.');
    }
    await tx.query(
      `UPDATE solicitudes_servicio SET id_tecnico = $1, estado = 'ASIGNADA', fecha_asignacion = NOW(),
         id_tecnico_propuesto = NULL, propuesto_hasta = NULL WHERE id_solicitud = $2`,
      [me, current.id_solicitud]
    );
    await tx.query('DELETE FROM tareas_servicio WHERE id_solicitud = $1 AND completada = false', [current.id_solicitud]);
    let orden = 0;
    for (const t of S.taskTemplate(current.categoria)) {
      orden += 1;
      await tx.query(
        "INSERT INTO tareas_servicio (id_solicitud, descripcion, origen, norma, orden) VALUES ($1, $2, 'PLANTILLA', $3, $4)",
        [current.id_solicitud, t.descripcion, t.norma || null, orden]
      );
    }
    // Anti-evasión: el precio base del técnico queda como cotización y el cliente debe pagarlo en custodia
    // antes de que se abran el chat y la dirección.
    await precioBase.crearCotizacionBase(tx, current, me);
    return S.findRow(current.id_solicitud, tx);
  });
  const base = `$${Number(row.precio_base).toFixed(2)}`;
  audit(req, 'SOLICITUD_ACEPTADA', 'solicitud', row.id_solicitud, { precio_base: row.precio_base });
  S.notify(row, `${row.tecnico_nombre} aceptó tu solicitud. Paga el precio base de ${base} para confirmar el servicio y abrir el chat.`, { push: [[row.id_usuario, 'Técnico asignado: paga para confirmar']] });
  return res.json({ success: true, mensaje: `Solicitud aceptada. Cuando el cliente pague el precio base (${base}) verás la dirección y se abrirá el chat.`, solicitud: S.shape(row, req.user) });
}

router.post('/api/solicitudes/:id/aceptar', auth, requireRole(ROL.TECNICO), requireApproved, acceptRequest);
router.put('/api/solicitudes/:id/aceptar', auth, requireRole(ROL.TECNICO), requireApproved, acceptRequest);

async function discardRequest(req, res) {
  const me = req.user.id_usuario;
  const row = await S.findRow(req.params.id);
  if (!row || row.estado !== 'PENDIENTE') return fail(res, 409, 'NOT_AVAILABLE', 'La solicitud ya no está disponible.');
  await db().query('INSERT INTO solicitudes_descartadas (id_solicitud, id_tecnico) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.id_solicitud, me]);
  if (row.id_tecnico_propuesto === me) {
    await db().query('UPDATE solicitudes_servicio SET id_tecnico_propuesto = NULL, propuesto_hasta = NULL WHERE id_solicitud = $1', [row.id_solicitud]);
    await db().query("UPDATE intentos_asignacion SET resultado = 'DESCARTADA' WHERE id_solicitud = $1 AND id_tecnico = $2", [row.id_solicitud, me]);
    if (row.modo_asignacion === 'AUTOMATICA') {
      // Búsqueda automática: pasa de inmediato al siguiente técnico más cercano.
      await asignacion.proponerSiguiente(row.id_solicitud).catch((error) => console.error('No se pudo proponer al siguiente técnico:', error.message));
    } else {
      realtime.emitToUser(row.id_usuario, 'solicitud.actualizada', {
        id_solicitud: Number(row.id_solicitud), estado: 'PENDIENTE', aviso: 'El técnico que elegiste no está disponible. Elige otro o usa la búsqueda automática.',
      });
    }
  }
  return res.json({ mensaje: 'Solicitud descartada. Ya no la verás en tu lista.' });
}

router.post('/api/solicitudes/:id/descartar', auth, requireRole(ROL.TECNICO), discardRequest);

// ───────────────────────── Ejecución (RF-60) ─────────────────────────
// Pago en custodia: el técnico no sale hacia el domicilio (ni ve la dirección) hasta que el cliente paga el
// precio base en custodia; con la custodia retenida, ya en el sitio, inicia el trabajo (EN_PROCESO).
const TECH_TRANSITIONS = { EN_CAMINO: ['ASIGNADA'], EN_SITIO: ['EN_CAMINO', 'ASIGNADA'], EN_PROCESO: ['EN_SITIO'] };
const TECH_AVISOS = {
  EN_CAMINO: ['va en camino.', 'Tu técnico va en camino'],
  EN_SITIO: ['llegó a tu domicilio.', 'Tu técnico llegó'],
  EN_PROCESO: ['inició el trabajo.', 'Trabajo iniciado'],
};

async function setTechState(req, res, estado) {
  const allowed = TECH_TRANSITIONS[estado];
  const current = await S.findRow(req.params.id);
  if (current && current.id_tecnico === req.user.id_usuario) {
    if (!current.direccion_liberada) {
      return fail(res, 409, 'CUSTODY_REQUIRED', 'El cliente aún no paga el precio base. Verás la dirección cuando lo haga.');
    }
    if (estado === 'EN_PROCESO' && current.custodia_estado !== 'RETENIDO') {
      return fail(res, 409, 'CUSTODY_REQUIRED', 'Para iniciar el trabajo, el cliente debe pagar el precio base en custodia.');
    }
  }
  const result = await db().query(
    `UPDATE solicitudes_servicio SET estado = $1::varchar, fecha_llegada = CASE WHEN $1::varchar = 'EN_SITIO' THEN NOW() ELSE fecha_llegada END
     WHERE id_solicitud = $2 AND id_tecnico = $3 AND estado = ANY($4) AND direccion_liberada = true RETURNING id_solicitud`,
    [estado, req.params.id, req.user.id_usuario, allowed]
  );
  if (!result.rowCount) return fail(res, 409, 'INVALID_TRANSITION', 'La solicitud no está asignada a ti o no puede pasar a ese estado.');
  const row = await S.findRow(req.params.id);
  const [aviso, titulo] = TECH_AVISOS[estado];
  S.notify(row, `${row.tecnico_nombre} ${aviso}`, { push: [[row.id_usuario, titulo]] });
  audit(req, `SOLICITUD_${estado}`, 'solicitud', row.id_solicitud);
  return res.json({ mensaje: 'Estado actualizado.', solicitud: S.shape(row, req.user) });
}

router.patch('/api/solicitudes/:id/estado', auth, requireRole(ROL.TECNICO), async (req, res, next) => {
  const estado = String(req.body?.estado || '').toUpperCase();
  if (TECH_TRANSITIONS[estado]) return setTechState(req, res, estado);
  // Compatibilidad: ASIGNADA = aceptar, CANCELADA = descartar o cancelar según el estado.
  if (estado === 'ASIGNADA') return requireApproved(req, res, () => acceptRequest(req, res).catch(next));
  if (estado === 'CANCELADA') {
    const row = await S.findRow(req.params.id);
    if (row?.estado === 'PENDIENTE') return discardRequest(req, res);
    return cancelRequest(req, res);
  }
  return fail(res, 400, 'INVALID_TRANSITION', 'Estado de transición no válido.');
});

// ───────────────────────── Cotización y conceptos (RF-62, RF-72) ─────────────────────────
function parseConceptos(list, allowedTypes) {
  if (!Array.isArray(list) || list.length === 0 || list.length > 20) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Agrega entre 1 y 20 conceptos a la cotización.');
  }
  return list.map((c, i) => {
    const tipo = String(c?.tipo || '').toUpperCase();
    const descripcion = sanitizeText(c?.descripcion, 200);
    const monto = parseMoney(c?.monto);
    if (!allowedTypes.includes(tipo)) throw new HttpError(400, 'VALIDATION_ERROR', `Concepto ${i + 1}: tipo no válido.`);
    if (!descripcion) throw new HttpError(400, 'VALIDATION_ERROR', `Concepto ${i + 1}: escribe una descripción.`);
    if (!monto) throw new HttpError(400, 'VALIDATION_ERROR', `Concepto ${i + 1}: el monto debe ser mayor a 0 y con máximo 2 decimales.`);
    return { tipo, descripcion, monto };
  });
}
const parseMoney = S.parseMoney;

async function quote(req, res) {
  const b = req.body || {};
  const conceptos = b.conceptos
    ? parseConceptos(b.conceptos, ['MANO_OBRA', 'MATERIAL'])
    : parseConceptos([{ tipo: 'MANO_OBRA', descripcion: b.detalles_cotizacion || b.detalles || 'Servicio', monto: b.monto_cotizacion ?? b.monto }], ['MANO_OBRA']);
  const minutos = Number.isInteger(Number(b.minutos)) && Number(b.minutos) > 0 ? Number(b.minutos) : null;
  const detalles = sanitizeText(b.detalles ?? b.detalles_cotizacion, 1000) || null;
  const idSolicitud = Number(req.params.id || b.id_solicitud || b.id);

  const out = await withTransaction(async (tx) => {
    const row = await S.findRow(idSolicitud, tx, { lock: true });
    if (!row || row.id_tecnico !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    // Precio base: la primera cotización la crea la app al aceptar. El técnico solo cotiza un adicional, ya en el
    // domicilio y con el precio base pagado: la cotización completa incluye lo ya pagado y el cliente paga la diferencia.
    if (row.custodia_estado !== 'RETENIDO') {
      throw new HttpError(409, 'BASE_PRICE_REQUIRED', 'El cliente aún no paga el precio base. Podrás cotizar un adicional cuando estés en el domicilio.');
    }
    if (!['EN_SITIO', 'ESPERANDO_APROBACION'].includes(row.estado) || !row.fecha_llegada) {
      throw new HttpError(409, 'INVALID_STATE', 'Solo puedes cotizar un adicional en el domicilio, antes de iniciar el trabajo.');
    }
    if (row.estado_pago === 'PROCESANDO') {
      throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'El cliente está pagando. Espera a que se confirme.');
    }
    const suma = conceptos.reduce((a, c) => a + Number(c.monto), 0);
    if (suma + 0.001 < Number(row.custodia_monto)) {
      throw new HttpError(400, 'VALIDATION_ERROR', `La cotización completa no puede ser menor a lo que el cliente ya pagó ($${Number(row.custodia_monto).toFixed(2)}). Incluye el precio base y agrega lo adicional.`);
    }
    await tx.query("UPDATE cotizaciones_servicio SET estado = 'REEMPLAZADA' WHERE id_solicitud = $1 AND estado = 'ENVIADA'", [row.id_solicitud]);
    const cot = (await tx.query(
      `INSERT INTO cotizaciones_servicio (id_solicitud, id_tecnico, monto_total, detalles, tiempo_estimado_minutos, estado)
       VALUES ($1, $2, 0, $3, $4, 'ENVIADA') RETURNING id_cotizacion`,
      [row.id_solicitud, req.user.id_usuario, detalles, minutos]
    )).rows[0];
    for (const c of conceptos) {
      await tx.query(
        'INSERT INTO conceptos_cotizacion (id_solicitud, id_cotizacion, tipo, descripcion, monto) VALUES ($1, $2, $3, $4, $5::numeric)',
        [row.id_solicitud, cot.id_cotizacion, c.tipo, c.descripcion, c.monto]
      );
    }
    const totals = (await tx.query(
      `UPDATE cotizaciones_servicio q SET
         monto_mano_obra = COALESCE((SELECT SUM(monto) FROM conceptos_cotizacion WHERE id_cotizacion = q.id_cotizacion AND tipo = 'MANO_OBRA'), 0),
         monto_materiales = COALESCE((SELECT SUM(monto) FROM conceptos_cotizacion WHERE id_cotizacion = q.id_cotizacion AND tipo = 'MATERIAL'), 0),
         monto_total = (SELECT SUM(monto) FROM conceptos_cotizacion WHERE id_cotizacion = q.id_cotizacion)
       WHERE q.id_cotizacion = $1
       RETURNING id_cotizacion, monto_mano_obra, monto_materiales, monto_total, detalles, tiempo_estimado_minutos, estado`,
      [cot.id_cotizacion]
    )).rows[0];
    await tx.query(
      "UPDATE solicitudes_servicio SET estado = 'ESPERANDO_APROBACION', monto_cotizacion = $1, detalles_cotizacion = $2 WHERE id_solicitud = $3",
      [totals.monto_total, detalles, row.id_solicitud]
    );
    return { totals, row: await S.findRow(row.id_solicitud, tx) };
  });
  const diferencia = Math.max(0, Number(out.totals.monto_total) - Number(out.row.custodia_monto || 0)).toFixed(2);
  S.notify(out.row, `Tu técnico pide un adicional: el trabajo completo cuesta $${Number(out.totals.monto_total).toFixed(2)}. Solo pagarías la diferencia de $${diferencia}.`, { push: [[out.row.id_usuario, 'Adicional por aprobar']] });
  audit(req, 'COTIZACION_ENVIADA', 'solicitud', out.row.id_solicitud, { total: out.totals.monto_total });
  return res.json({ success: true, mensaje: 'Cotización enviada.', cotizacion: out.totals, solicitud: S.shape(out.row, req.user) });
}

router.post('/api/solicitudes/:id/cotizar', auth, requireRole(ROL.TECNICO), requireApproved, quote);
router.post('/api/cotizaciones', auth, requireRole(ROL.TECNICO), requireApproved, quote);

// Motivos con los que el cliente rechaza un adicional (el técnico los ve tal cual).
const MOTIVOS_RECHAZO = { PRECIO_ALTO: 'el precio le parece alto', NO_LO_DESEA: 'no desea el trabajo adicional', OTRO: 'otro motivo' };

// Pago en custodia: aprobar la cotización es pagarla (POST /api/solicitudes/:id/custodia). Aquí solo se rechaza.
router.patch('/api/solicitudes/:id/responder-cotizacion', auth, requireRole(ROL.CLIENTE), async (req, res) => {
  const decision = String(req.body?.respuesta || '').toUpperCase();
  if (!['ACEPTAR', 'RECHAZAR'].includes(decision)) return fail(res, 400, 'VALIDATION_ERROR', 'Respuesta inválida. Debe ser ACEPTAR o RECHAZAR.');
  if (decision === 'ACEPTAR') {
    return fail(res, 409, 'CUSTODY_REQUIRED', 'Para aprobar la cotización, págala en custodia: el dinero se libera al técnico cuando confirmes el trabajo.');
  }
  // El cliente dice por qué rechaza el adicional; el técnico lo ve y puede mandar otra cotización.
  const motivo = String(req.body?.motivo || '').toUpperCase();
  const comentario = sanitizeText(req.body?.comentario, 300) || null;
  const row = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current || current.id_usuario !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (current.estado !== 'ESPERANDO_APROBACION') throw new HttpError(409, 'INVALID_STATE', 'La cotización ya no está pendiente de respuesta.');
    if (current.estado_pago === 'PROCESANDO') throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'Estamos confirmando tu pago de esta cotización con el banco.');
    if (current.custodia_estado !== 'RETENIDO') {
      throw new HttpError(409, 'BASE_PRICE_REQUIRED', 'El precio base no se negocia: págalo para confirmar el servicio o cancela la solicitud sin cargo.');
    }
    if (!MOTIVOS_RECHAZO[motivo]) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Dinos por qué rechazas el adicional: precio alto, no lo quieres u otro motivo.', { field: 'motivo' });
    }
    if (motivo === 'OTRO' && (!comentario || comentario.length < 3)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Escribe brevemente el motivo.', { field: 'comentario' });
    }
    await tx.query(
      `UPDATE cotizaciones_servicio SET estado = 'RECHAZADA', fecha_respuesta = NOW(), motivo_rechazo = $2, comentario_rechazo = $3
       WHERE id_solicitud = $1 AND estado = 'ENVIADA'`,
      [current.id_solicitud, motivo, comentario]
    );
    // Rechazada a distancia vuelve a ASIGNADA; rechazada en el domicilio vuelve a EN_SITIO.
    await tx.query(
      "UPDATE solicitudes_servicio SET estado = CASE WHEN fecha_llegada IS NULL THEN 'ASIGNADA' ELSE 'EN_SITIO' END WHERE id_solicitud = $1",
      [current.id_solicitud]
    );
    return S.findRow(current.id_solicitud, tx);
  });
  const porque = `${MOTIVOS_RECHAZO[motivo]}${comentario ? `: "${comentario}"` : ''}`;
  audit(req, 'ADICIONAL_RECHAZADO', 'solicitud', row.id_solicitud, { motivo });
  S.notify(row, `El cliente rechazó el adicional (${porque}). Puedes hacer el trabajo del precio base o enviar otra cotización.`, { push: [[row.id_tecnico, 'Adicional rechazado']] });
  res.json({ mensaje: 'Adicional rechazado. El técnico puede hacer el trabajo del precio base que ya pagaste.', solicitud: S.shape(row, req.user) });
});

// Pago en custodia (anti-evasión). Dos momentos:
//  1) Precio base: al aceptar, la app crea la cotización base; el cliente la paga aquí y se abren el chat y la
//     dirección. La comisión queda asegurada desde este momento.
//  2) Adicional: ya en el domicilio, el técnico cotiza el trabajo completo; el cliente paga solo la diferencia
//     contra lo que ya está en custodia y la custodia crece a ese total.
// El dinero se libera al técnico (menos la comisión) solo cuando el cliente confirma el trabajo.
// Mismo patrón que /confirmar: reserva (PROCESANDO) → cobro → registro, para no cobrar dos veces.
router.post('/api/solicitudes/:id/custodia', auth, requireRole(ROL.CLIENTE), idempotent('solicitud.custodia'), async (req, res) => {
  const idMetodo = Number(req.body?.id_metodo);
  const { row, metodo, cot, previo, retenida, porCobrar } = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current || current.id_usuario !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (current.estado_pago === 'PROCESANDO') {
      throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'Estamos confirmando tu pago anterior con el banco. No se te cobrará dos veces; si no se resuelve en unos minutos, escribe a soporte.');
    }
    if (current.estado !== 'ESPERANDO_APROBACION') throw new HttpError(409, 'INVALID_STATE', 'No hay un precio pendiente de pago.');
    const quote = (await tx.query(
      `SELECT q.id_cotizacion, (SELECT total FROM cs_liquidacion(q.monto_total)) AS total
       FROM cotizaciones_servicio q WHERE q.id_solicitud = $1 AND q.estado = 'ENVIADA' AND q.monto_total > 0
       ORDER BY q.id_cotizacion DESC LIMIT 1`,
      [current.id_solicitud]
    )).rows[0];
    if (!quote) throw new HttpError(409, 'QUOTE_OUTDATED', 'Este precio ya no es válido. Pide al técnico que te envíe uno nuevo.');
    const custodia = await custodiaRetenida(tx, current.id_solicitud);
    const diff = (await tx.query('SELECT GREATEST($1::numeric - $2::numeric, 0)::numeric(19,2) AS d', [quote.total, custodia?.monto ?? 0])).rows[0].d;
    let card = null;
    if (Number(diff) > 0) {
      card = (await tx.query('SELECT id_metodo, token FROM metodos_pago WHERE id_metodo = $1 AND id_usuario = $2', [idMetodo, req.user.id_usuario])).rows[0];
      if (!card?.token) throw new HttpError(400, 'PAYMENT_METHOD_REQUIRED', 'Selecciona una tarjeta guardada para pagar.');
    }
    await tx.query("UPDATE solicitudes_servicio SET estado_pago = 'PROCESANDO' WHERE id_solicitud = $1", [current.id_solicitud]);
    return { row: current, metodo: card, cot: quote, previo: current.estado_pago, retenida: custodia, porCobrar: diff };
  });

  const esAdicional = !!retenida;
  let charge = { ok: true, modo: retenida?.modo, referencia: null };
  if (Number(porCobrar) > 0) {
    charge = await chargeCard({
      token: metodo.token,
      amount: porCobrar,
      description: esAdicional ? `Adicional del servicio ${row.folio}` : `Precio base del servicio ${row.folio}`,
      customer: { nombre: `${row.cliente_nombre} ${row.cliente_apellido}`, correo: req.user.correo, telefono: row.cliente_telefono },
      // Llave nueva por intento: Stripe guarda 24 h la respuesta de cada llave, también un rechazo, y una llave fija
      // impediría reintentar con la misma tarjeta. El doble cobro lo evita la reserva PROCESANDO de arriba.
      idempotencyKey: `cs-custodia-${row.id_solicitud}-${randomUUID()}`,
      metadata: { folio: row.folio, id_solicitud: row.id_solicitud, etapa: esAdicional ? 'adicional' : 'precio_base' },
    });
  }
  if (!charge.ok) {
    if (charge.uncertain) {
      audit(req, 'CUSTODIA_INCIERTA', 'solicitud', row.id_solicitud, { motivo: charge.motivo, monto: porCobrar });
      return fail(res, 503, 'PAYMENT_UNCERTAIN', 'El banco no confirmó el cobro a tiempo. Para no cobrarte dos veces lo revisaremos y te avisaremos; no intentes pagar de nuevo.');
    }
    await db().query("UPDATE solicitudes_servicio SET estado_pago = $2 WHERE id_solicitud = $1 AND estado_pago = 'PROCESANDO'", [row.id_solicitud, previo || 'PENDIENTE']);
    return fail(res, charge.unavailable ? 503 : 402, charge.unavailable ? 'PAYMENT_UNAVAILABLE' : 'PAYMENT_DECLINED', charge.motivo);
  }

  const out = await withTransaction(async (tx) => {
    let custodia;
    if (esAdicional) {
      // La custodia crece al total del trabajo completo; la referencia junta los cobros.
      custodia = (await tx.query(
        `UPDATE custodias SET monto = $2::numeric,
           referencia = CASE WHEN $3::text IS NULL THEN referencia ELSE CONCAT_WS('+', referencia, $3::text) END
         WHERE id_custodia = $1 RETURNING monto, modo, referencia, fecha_cobro`,
        [retenida.id_custodia, cot.total, charge.referencia]
      )).rows[0];
      await tx.query("UPDATE cotizaciones_servicio SET estado = 'REEMPLAZADA' WHERE id_solicitud = $1 AND estado = 'ACEPTADA'", [row.id_solicitud]);
    } else {
      custodia = (await tx.query(
        `INSERT INTO custodias (id_solicitud, id_cliente, id_metodo, monto, modo, referencia, estado)
         VALUES ($1, $2, $3, $4::numeric, $5, $6, 'RETENIDO') RETURNING monto, modo, referencia, fecha_cobro`,
        [row.id_solicitud, req.user.id_usuario, metodo.id_metodo, cot.total, charge.modo, charge.referencia]
      )).rows[0];
    }
    await tx.query("UPDATE cotizaciones_servicio SET estado = 'ACEPTADA', fecha_respuesta = NOW() WHERE id_cotizacion = $1", [cot.id_cotizacion]);
    // Precio base pagado (a distancia): ASIGNADA, el técnico ya puede salir. Adicional pagado en el domicilio:
    // empieza el trabajo. Si mientras se cobraba se abrió una incidencia (SUSPENDIDA), el estado al que vuelve es el nuevo.
    await tx.query(
      `UPDATE solicitudes_servicio SET
         estado = CASE WHEN estado = 'ESPERANDO_APROBACION'
                       THEN CASE WHEN fecha_llegada IS NULL THEN 'ASIGNADA' ELSE 'EN_PROCESO' END ELSE estado END,
         estado_previo = CASE WHEN estado = 'SUSPENDIDA' AND estado_previo = 'ESPERANDO_APROBACION'
                              THEN CASE WHEN fecha_llegada IS NULL THEN 'ASIGNADA' ELSE 'EN_PROCESO' END ELSE estado_previo END,
         monto_total = $2::numeric, estado_pago = 'EN_CUSTODIA', direccion_liberada = true
       WHERE id_solicitud = $1`,
      [row.id_solicitud, cot.total]
    );
    return { row: await S.findRow(row.id_solicitud, tx), custodia };
  }).catch((error) => {
    console.error(`Custodia ${charge.referencia} de ${row.folio} sin registrar:`, error.message);
    audit(req, 'CUSTODIA_SIN_REGISTRAR', 'solicitud', row.id_solicitud, { referencia: charge.referencia, modo: charge.modo, monto: porCobrar });
    throw error;
  });

  audit(req, esAdicional ? 'ADICIONAL_PAGADO' : 'CUSTODIA_PAGADA', 'solicitud', row.id_solicitud, { monto: out.custodia.monto, cobrado: porCobrar, modo: out.custodia.modo });
  const avisoTecnico = esAdicional
    ? 'El cliente aprobó y pagó el adicional en custodia. Ya puedes iniciar el trabajo.'
    : 'El cliente pagó el precio base en custodia. Ya puedes ver la dirección, platicar por chat y salir hacia el domicilio.';
  S.notify(out.row, avisoTecnico, { push: [[out.row.id_tecnico, esAdicional ? 'Adicional pagado' : 'Precio base pagado']] });
  res.json({
    mensaje: esAdicional
      ? `Pagaste la diferencia de $${Number(porCobrar).toFixed(2)}. Todo queda en custodia hasta que confirmes que el trabajo quedó bien.`
      : 'Pagaste el precio base en custodia. Ya puedes platicar con tu técnico por chat; liberaremos el dinero cuando confirmes que el trabajo quedó bien.',
    solicitud: S.shape(out.row, req.user),
    custodia: out.custodia,
    cobrado: porCobrar,
  });
});

router.post('/api/solicitudes/:id/conceptos', auth, requireRole(ROL.TECNICO), async (req, res) => {
  const [c] = parseConceptos([{ ...req.body, tipo: 'EXTRA' }], ['EXTRA']);
  const row = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current || current.id_tecnico !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (current.estado !== 'EN_PROCESO') throw new HttpError(409, 'INVALID_STATE', 'Solo puedes agregar conceptos mientras el trabajo está en proceso.');
    await tx.query("INSERT INTO conceptos_cotizacion (id_solicitud, tipo, descripcion, monto) VALUES ($1, 'EXTRA', $2, $3::numeric)", [current.id_solicitud, c.descripcion, c.monto]);
    await recalcTotal(tx, current.id_solicitud);
    return S.findRow(current.id_solicitud, tx);
  });
  S.notify(row, `Se agregó un concepto adicional: ${c.descripcion} ($${c.monto}).`, { push: [[row.id_usuario, 'Concepto adicional']] });
  res.status(201).json({ mensaje: 'Concepto agregado.', solicitud: S.shape(row, req.user) });
});

router.delete('/api/solicitudes/:id/conceptos/:idConcepto', auth, requireRole(ROL.TECNICO), async (req, res) => {
  const row = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current || current.id_tecnico !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (current.estado !== 'EN_PROCESO') throw new HttpError(409, 'INVALID_STATE', 'Ya no puedes modificar los conceptos.');
    const del = await tx.query("DELETE FROM conceptos_cotizacion WHERE id_concepto = $1 AND id_solicitud = $2 AND tipo = 'EXTRA'", [req.params.idConcepto, current.id_solicitud]);
    if (!del.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Concepto no encontrado.');
    await recalcTotal(tx, current.id_solicitud);
    return S.findRow(current.id_solicitud, tx);
  });
  S.notify(row, 'Se actualizaron los conceptos del servicio.');
  res.json({ mensaje: 'Concepto eliminado.', solicitud: S.shape(row, req.user) });
});

// Total = cotización aceptada + extras, calculado en SQL.
function recalcTotal(tx, idSolicitud) {
  return tx.query(
    `UPDATE solicitudes_servicio SET monto_total =
       COALESCE((SELECT monto_total FROM cotizaciones_servicio WHERE id_solicitud = $1 AND estado = 'ACEPTADA' ORDER BY id_cotizacion DESC LIMIT 1), 0)
       + COALESCE((SELECT SUM(monto) FROM conceptos_cotizacion WHERE id_solicitud = $1 AND tipo = 'EXTRA'), 0)
     WHERE id_solicitud = $1`,
    [idSolicitud]
  );
}

// ───────────────────────── Tareas (RF-62) ─────────────────────────
async function assignedOr404(id, user) {
  const row = await S.findRow(id);
  if (!row || row.id_tecnico !== user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
  return row;
}

router.get('/api/solicitudes/:id/tareas', auth, async (req, res) => {
  const row = await loadOr404(req.params.id, req.user);
  const { rows } = await db().query('SELECT id_tarea, descripcion, origen, norma, completada, fecha_completada FROM tareas_servicio WHERE id_solicitud = $1 ORDER BY orden, id_tarea', [row.id_solicitud]);
  res.json({ tareas: rows });
});

router.post('/api/solicitudes/:id/tareas', auth, requireRole(ROL.TECNICO), async (req, res) => {
  const row = await assignedOr404(req.params.id, req.user);
  const descripcion = sanitizeText(req.body?.descripcion, 200);
  if (!descripcion) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe la tarea.');
  const { rows } = await db().query(
    "INSERT INTO tareas_servicio (id_solicitud, descripcion, origen, orden) VALUES ($1, $2, 'TECNICO', 100) RETURNING id_tarea, descripcion, origen, norma, completada",
    [row.id_solicitud, descripcion]
  );
  res.status(201).json({ tarea: rows[0] });
});

router.patch('/api/solicitudes/:id/tareas/:idTarea', auth, requireRole(ROL.TECNICO), async (req, res) => {
  const row = await assignedOr404(req.params.id, req.user);
  const completada = req.body?.completada === true;
  const { rows } = await db().query(
    `UPDATE tareas_servicio SET completada = $1, fecha_completada = CASE WHEN $1 THEN NOW() ELSE NULL END
     WHERE id_tarea = $2 AND id_solicitud = $3 RETURNING id_tarea, descripcion, origen, norma, completada, fecha_completada`,
    [completada, req.params.idTarea, row.id_solicitud]
  );
  if (!rows[0]) return fail(res, 404, 'NOT_FOUND', 'Tarea no encontrada.');
  res.json({ tarea: rows[0] });
});

// ───────────────────────── Evidencias y cierre (RF-65, RF-53/54, RF-69/70) ─────────────────────────
const EVIDENCE_TYPES = { ANTES: 'PRE_TRABAJO', DURANTE: 'EN_PROCESO', DESPUES: 'POST_TRABAJO' };

router.post('/api/solicitudes/:id/evidencias', auth, requireRole(ROL.TECNICO), uploader({ maxFiles: 5 }).array('fotos', 5), async (req, res) => {
  const row = await assignedOr404(req.params.id, req.user);
  if (!['EN_SITIO', 'ESPERANDO_APROBACION', 'EN_PROCESO'].includes(row.estado)) {
    return fail(res, 409, 'INVALID_STATE', 'Solo puedes subir evidencias mientras estás en el domicilio.');
  }
  if (!req.files?.length) return fail(res, 400, 'VALIDATION_ERROR', 'Agrega al menos una foto.');
  const tipo = EVIDENCE_TYPES[String(req.body?.tipo || 'DESPUES').toUpperCase()] || 'POST_TRABAJO';
  const descripcion = sanitizeText(req.body?.descripcion, 300) || null;
  const evidencias = await withTransaction(async (tx) => {
    const out = [];
    for (const f of req.files) {
      const idArchivo = await saveFile(tx, { owner: req.user.id_usuario, buffer: f.buffer, mime: f.mimetype, name: f.originalname, categoria: 'EVIDENCIA' });
      const { rows } = await tx.query(
        `INSERT INTO evidencias_servicio (id_solicitud, id_tecnico, tipo_evidencia, descripcion, id_archivo)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_evidencia, tipo_evidencia, descripcion, id_archivo, fecha_subida`,
        [row.id_solicitud, req.user.id_usuario, tipo, descripcion, idArchivo]
      );
      out.push({ ...rows[0], url: signFileUrl(idArchivo) });
    }
    return out;
  });
  S.notify(row, 'El técnico agregó evidencia del trabajo.');
  res.status(201).json({ evidencias });
});

router.post('/api/solicitudes/:id/finalizar', auth, requireRole(ROL.TECNICO), idempotent('solicitud.finalizar'), async (req, res) => {
  const row = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current || current.id_tecnico !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (current.estado !== 'EN_PROCESO') throw new HttpError(409, 'INVALID_STATE', 'Solo puedes finalizar un trabajo en proceso con cotización aprobada.');
    const ev = await tx.query('SELECT COUNT(*)::int AS n FROM evidencias_servicio WHERE id_solicitud = $1', [current.id_solicitud]);
    if (ev.rows[0].n === 0) throw new HttpError(400, 'EVIDENCE_REQUIRED', 'Sube al menos una foto del trabajo terminado antes de finalizar.');
    await tx.query("UPDATE solicitudes_servicio SET estado = 'POR_CONFIRMAR' WHERE id_solicitud = $1", [current.id_solicitud]);
    return S.findRow(current.id_solicitud, tx);
  });
  audit(req, 'SOLICITUD_TERMINADA', 'solicitud', row.id_solicitud);
  S.notify(row, 'El técnico terminó el trabajo. Confirma el servicio y realiza el pago.', { push: [[row.id_usuario, 'Confirma tu servicio']] });
  res.json({ mensaje: 'Trabajo terminado. El cliente debe confirmar el servicio.', solicitud: S.shape(row, req.user) });
});

// RF-70: el pago se formaliza solo aquí ("ENVIAR Y FINALIZAR"). El total sale de la base, nunca del cliente.
router.post('/api/solicitudes/:id/confirmar', auth, requireRole(ROL.CLIENTE), idempotent('solicitud.confirmar'), async (req, res) => {
  const idMetodo = Number(req.body?.id_metodo);
  const calificacion = req.body?.calificacion == null ? null : Number(req.body.calificacion);
  if (calificacion != null && !(Number.isInteger(calificacion) && calificacion >= 1 && calificacion <= 5)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'La calificación debe ser de 1 a 5 estrellas.');
  }
  const comentario = sanitizeText(req.body?.comentario, 500) || null;

  // Paso 1: reserva el cobro (estado_pago = PROCESANDO) en su propia transacción. Si la pasarela no
  // responde o el registro falla después de cobrar, la reserva sigue ahí y ningún reintento vuelve a cobrar.
  // Con pago en custodia solo se cobra la diferencia (conceptos extra); sin diferencia no se toca la tarjeta.
  const { row, metodo, liq, custodia, porCobrar, previo } = await withTransaction(async (tx) => {
    const current = await S.findRow(req.params.id, tx, { lock: true });
    if (!current || current.id_usuario !== req.user.id_usuario) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (current.estado_pago === 'PROCESANDO') {
      throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'Estamos confirmando tu pago anterior con el banco. No se te cobrará dos veces; si no se resuelve en unos minutos, escribe a soporte.');
    }
    if (current.estado !== 'POR_CONFIRMAR') throw new HttpError(409, 'INVALID_STATE', 'Este servicio no está listo para confirmarse.');
    const liquidacion = (await tx.query('SELECT * FROM cs_liquidacion($1)', [current.monto_total])).rows[0];
    const retenida = await custodiaRetenida(tx, current.id_solicitud);
    const diff = (await tx.query('SELECT GREATEST($1::numeric - $2::numeric, 0) AS por_cobrar', [liquidacion.total, retenida?.monto ?? 0])).rows[0].por_cobrar;
    let card = null;
    if (Number(diff) > 0) {
      card = (await tx.query('SELECT id_metodo, token FROM metodos_pago WHERE id_metodo = $1 AND id_usuario = $2', [idMetodo, req.user.id_usuario])).rows[0];
      if (!card?.token) throw new HttpError(400, 'PAYMENT_METHOD_REQUIRED', 'Selecciona una tarjeta guardada para pagar.');
    }
    await tx.query("UPDATE solicitudes_servicio SET estado_pago = 'PROCESANDO' WHERE id_solicitud = $1", [current.id_solicitud]);
    return { row: current, metodo: card, liq: liquidacion, custodia: retenida, porCobrar: diff, previo: current.estado_pago };
  });

  let charge = { ok: true, modo: custodia?.modo, referencia: null };
  if (Number(porCobrar) > 0) {
    charge = await chargeCard({
      token: metodo.token,
      amount: porCobrar,
      description: custodia ? `Conceptos adicionales del servicio ${row.folio}` : `Servicio ${row.folio}`,
      customer: { nombre: `${row.cliente_nombre} ${row.cliente_apellido}`, correo: req.user.correo, telefono: row.cliente_telefono },
      idempotencyKey: `cs-confirmar-${row.id_solicitud}-${randomUUID()}`,
      metadata: { folio: row.folio, id_solicitud: row.id_solicitud, etapa: 'confirmar' },
    });
  }
  if (!charge.ok) {
    if (charge.uncertain) {
      audit(req, 'PAGO_INCIERTO', 'solicitud', row.id_solicitud, { motivo: charge.motivo, monto: porCobrar });
      return fail(res, 503, 'PAYMENT_UNCERTAIN', 'El banco no confirmó el cobro a tiempo. Para no cobrarte dos veces lo revisaremos y te avisaremos; no intentes pagar de nuevo.');
    }
    await db().query("UPDATE solicitudes_servicio SET estado_pago = $2 WHERE id_solicitud = $1 AND estado_pago = 'PROCESANDO'", [row.id_solicitud, previo || 'PENDIENTE']);
    return fail(res, charge.unavailable ? 503 : 402, charge.unavailable ? 'PAYMENT_UNAVAILABLE' : 'PAYMENT_DECLINED', charge.motivo);
  }

  // Paso 2: registra el pago ya cobrado. Si esto falla, la orden queda en PROCESANDO con la referencia
  // en auditoría para conciliarla, en vez de liberar la orden para un segundo cargo.
  const out = await withTransaction(async (tx) => {
    const desglose = {
      total: liq.total, comision: liq.comision, base: liq.base,
      retencion_isr: liq.retencion_isr, retencion_iva: liq.retencion_iva, neto_tecnico: liq.neto_tecnico,
    };
    // El pago registra el total del servicio; la referencia junta la de la custodia y la del cobro adicional.
    const referencia = [custodia?.referencia, charge.referencia].filter(Boolean).join('+') || null;
    const pago = (await tx.query(
      `INSERT INTO pagos (id_solicitud, id_cliente, id_metodo, monto, estado, modo, referencia, desglose)
       VALUES ($1, $2, $3, $4, 'PAGADO', $5, $6, $7) RETURNING monto, modo, referencia, estado, fecha`,
      [row.id_solicitud, req.user.id_usuario, metodo?.id_metodo ?? null, row.monto_total, charge.modo, referencia, JSON.stringify(desglose)]
    )).rows[0];
    if (custodia) await liberarCustodia(tx, custodia.id_custodia);
    await tx.query(
      `UPDATE solicitudes_servicio SET estado = 'FINALIZADA', estado_pago = 'PAGADO', fecha_finalizacion = NOW(),
         garantia_hasta = CURRENT_DATE + 90 WHERE id_solicitud = $1`,
      [row.id_solicitud]
    );
    const wallet = (await tx.query(
      `INSERT INTO billetera_tecnico (id_usuario, saldo_actual) VALUES ($1, 0)
       ON CONFLICT (id_usuario) DO UPDATE SET id_usuario = EXCLUDED.id_usuario RETURNING id_billetera`,
      [row.id_tecnico]
    )).rows[0];
    await tx.query(
      'UPDATE billetera_tecnico SET saldo_actual = saldo_actual + $1::numeric, fecha_actualizacion = NOW() WHERE id_billetera = $2',
      [liq.neto_tecnico, wallet.id_billetera]
    );
    await tx.query(
      `INSERT INTO transacciones (id_billetera, monto, tipo, estado, folio, concepto, id_solicitud, desglose)
       VALUES ($1, $2::numeric, 'INGRESO', 'COMPLETADO', $3, 'SERVICIO', $4, $5)`,
      [wallet.id_billetera, liq.neto_tecnico, S.folio('TRX'), row.id_solicitud, JSON.stringify(desglose)]
    );
    if (calificacion != null) {
      await upsertRating(tx, row, { puntuacion_tecnico: calificacion, comentario_cliente: comentario });
    }
    return { row: await S.findRow(row.id_solicitud, tx), pago, desglose };
  }).catch((error) => {
    console.error(`Cobro ${charge.referencia} de ${row.folio} sin registrar:`, error.message);
    audit(req, 'PAGO_SIN_REGISTRAR', 'solicitud', row.id_solicitud, { referencia: charge.referencia, modo: charge.modo, monto: liq.total });
    throw error;
  });

  audit(req, 'PAGO_REALIZADO', 'solicitud', out.row.id_solicitud, { monto: out.pago.monto, modo: out.pago.modo });
  S.notify(out.row, `El cliente confirmó y pagó el servicio ${out.row.folio}. Ganaste $${out.desglose.neto_tecnico}.`, { push: [[out.row.id_tecnico, 'Pago recibido']] });
  realtime.emitToUser(out.row.id_tecnico, 'billetera.actualizada', { id_solicitud: Number(out.row.id_solicitud) });
  res.json({
    mensaje: 'Servicio confirmado y pagado. ¡Gracias por usar Click & Serve!',
    solicitud: S.shape(out.row, req.user),
    pago: out.pago,
    desglose: out.desglose,
  });
});

// Compatibilidad: el cobro directo sin confirmación ya no existe (RF-70).
router.post('/api/pagos/checkout', auth, (_req, res) => fail(res, 410, 'ENDPOINT_REPLACED', 'Confirma el servicio desde la app para realizar el pago.'));

// ───────────────────────── Calificaciones (RF-43) ─────────────────────────
async function upsertRating(tx, row, values) {
  await tx.query(
    `INSERT INTO calificaciones_servicio (id_solicitud, id_cliente, id_tecnico, puntuacion_tecnico, comentario_cliente, puntuacion_cliente, comentario_tecnico)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id_solicitud) DO UPDATE SET
       puntuacion_tecnico = COALESCE(EXCLUDED.puntuacion_tecnico, calificaciones_servicio.puntuacion_tecnico),
       comentario_cliente = COALESCE(EXCLUDED.comentario_cliente, calificaciones_servicio.comentario_cliente),
       puntuacion_cliente = COALESCE(EXCLUDED.puntuacion_cliente, calificaciones_servicio.puntuacion_cliente),
       comentario_tecnico = COALESCE(EXCLUDED.comentario_tecnico, calificaciones_servicio.comentario_tecnico),
       fecha_calificacion = NOW()`,
    [row.id_solicitud, row.id_usuario, row.id_tecnico, values.puntuacion_tecnico ?? null, values.comentario_cliente ?? null, values.puntuacion_cliente ?? null, values.comentario_tecnico ?? null]
  );
  if (values.puntuacion_tecnico != null) {
    await tx.query(
      'UPDATE solicitudes_servicio SET calificacion = $1::int, calificacion_cliente = $1::int, comentario_calificacion = $2::text, comentario_cliente = $2::text WHERE id_solicitud = $3',
      [values.puntuacion_tecnico, values.comentario_cliente ?? null, row.id_solicitud]
    );
  }
}

function parseRating(body) {
  const n = Number(body?.calificacion_cliente ?? body?.calificacion);
  if (!(Number.isInteger(n) && n >= 1 && n <= 5)) throw new HttpError(400, 'VALIDATION_ERROR', 'Debes proporcionar una calificación válida de 1 a 5 estrellas.');
  return { n, comentario: sanitizeText(body?.comentario_cliente ?? body?.comentario ?? body?.resena, 500) || null };
}

router.post(['/api/solicitudes/:id/calificar', '/api/servicios/calificar', '/api/resenas'], auth, async (req, res) => {
  const { n, comentario } = parseRating(req.body);
  const id = req.params.id || req.body?.id_servicio || req.body?.id_solicitud || req.body?.id;
  const row = await S.findRow(id);
  if (!row || row.id_usuario !== req.user.id_usuario) return fail(res, 404, 'NOT_FOUND', 'No se encontró la solicitud.');
  if (row.estado !== 'FINALIZADA') return fail(res, 409, 'INVALID_STATE', 'Podrás calificar cuando el servicio esté finalizado.');
  await withTransaction((tx) => upsertRating(tx, row, { puntuacion_tecnico: n, comentario_cliente: comentario }));
  realtime.emitToUser(row.id_tecnico, 'calificacion.recibida', { id_solicitud: Number(row.id_solicitud), calificacion: n });
  res.json({ mensaje: 'Calificación registrada. ¡Gracias!', solicitud: S.shape(await S.findRow(row.id_solicitud), req.user) });
});

router.post('/api/solicitudes/:id/calificar-cliente', auth, requireRole(ROL.TECNICO), async (req, res) => {
  const { n, comentario } = parseRating(req.body);
  const row = await S.findRow(req.params.id);
  if (!row || row.id_tecnico !== req.user.id_usuario) return fail(res, 404, 'NOT_FOUND', 'No se encontró la solicitud.');
  if (row.estado !== 'FINALIZADA') return fail(res, 409, 'INVALID_STATE', 'Podrás calificar cuando el servicio esté finalizado.');
  await withTransaction((tx) => upsertRating(tx, row, { puntuacion_cliente: n, comentario_tecnico: comentario }));
  res.json({ mensaje: 'Calificación al cliente registrada.', solicitud: S.shape(await S.findRow(row.id_solicitud), req.user) });
});

// ───────────────────────── Cancelaciones (RF-51/57, RF-61) ─────────────────────────
const CLIENT_CANCELABLE = ['PENDIENTE', 'ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'ESPERANDO_APROBACION'];
const TECH_CANCELABLE = ['ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'ESPERANDO_APROBACION'];

async function cancelRequest(req, res) {
  const motivo = sanitizeText(req.body?.motivo, 300);
  const out = await withTransaction(async (tx) => {
    const row = await S.findRow(req.params.id, tx, { lock: true });
    const isClient = row?.id_usuario === req.user.id_usuario;
    const isTech = row?.id_tecnico === req.user.id_usuario;
    if (!row || (!isClient && !isTech)) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
    if (row.estado_pago === 'PROCESANDO') {
      throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'Hay un cobro en curso para este servicio. Espera a que se confirme o escribe a soporte.');
    }

    if (isClient) {
      if (!CLIENT_CANCELABLE.includes(row.estado)) {
        throw new HttpError(409, 'INVALID_STATE', 'El trabajo ya inició. Si hay un problema, repórtalo como incidencia.');
      }
      await tx.query(
        `UPDATE solicitudes_servicio SET estado = 'CANCELADA', cancelado_por = 'CLIENTE', motivo_cancelacion = $1,
           estado_pago = 'NO_APLICA', id_tecnico_propuesto = NULL WHERE id_solicitud = $2`,
        [motivo || 'Cancelada por el cliente', row.id_solicitud]
      );
      await tx.query("UPDATE reprogramaciones SET estado = 'CANCELADA' WHERE id_solicitud = $1 AND estado = 'PENDIENTE'", [row.id_solicitud]);
      // Cancelar cuando el técnico ya salió (a tiempo) cuesta la visita: se cobra de la custodia y el resto se devuelve.
      const cargo = precioBase.cargoCancelacion(row);
      const visita = cargo ? await precioBase.cobrarCargoCancelacion(tx, row, cargo) : null;
      const reembolso = await marcarReembolso(tx, row.id_solicitud);
      return { previous: row, row: await S.findRow(row.id_solicitud, tx), by: 'CLIENTE', reembolso, visita };
    }

    if (motivo.length < 3) throw new HttpError(400, 'VALIDATION_ERROR', 'Indica el motivo de la cancelación.', { field: 'motivo' });
    if (!TECH_CANCELABLE.includes(row.estado)) throw new HttpError(409, 'INVALID_STATE', 'Ya no puedes cancelar este servicio; contacta a soporte.');
    await tx.query(
      `UPDATE solicitudes_servicio SET estado = 'PENDIENTE', id_tecnico = NULL, fecha_asignacion = NULL, fecha_llegada = NULL,
         motivo_cancelacion = $1, cancelado_por = 'TECNICO', monto_cotizacion = NULL, precio_base = NULL WHERE id_solicitud = $2`,
      [motivo, row.id_solicitud]
    );
    await tx.query("UPDATE cotizaciones_servicio SET estado = 'CANCELADA' WHERE id_solicitud = $1 AND estado IN ('ENVIADA', 'ACEPTADA')", [row.id_solicitud]);
    await tx.query('DELETE FROM tareas_servicio WHERE id_solicitud = $1', [row.id_solicitud]);
    await tx.query("UPDATE reprogramaciones SET estado = 'CANCELADA' WHERE id_solicitud = $1 AND estado = 'PENDIENTE'", [row.id_solicitud]);
    await tx.query('INSERT INTO solicitudes_descartadas (id_solicitud, id_tecnico) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.id_solicitud, req.user.id_usuario]);
    const reembolso = await marcarReembolso(tx, row.id_solicitud);
    return { previous: row, row: await S.findRow(row.id_solicitud, tx), by: 'TECNICO', reembolso };
  });

  audit(req, 'SOLICITUD_CANCELADA', 'solicitud', out.row.id_solicitud, { por: out.by, motivo, reembolso: out.reembolso, cargo_visita: out.visita?.cargo });
  if (out.by === 'CLIENTE') {
    if (out.previous.id_tecnico) {
      const avisoTec = out.visita
        ? `El cliente canceló ${out.row.folio} cuando ya ibas. Te pagamos la visita: $${Number(out.visita.neto_tecnico).toFixed(2)} a tu billetera.`
        : `El cliente canceló ${out.row.folio}.`;
      realtime.emitToUser(out.previous.id_tecnico, 'solicitud.actualizada', { id_solicitud: Number(out.row.id_solicitud), estado: 'CANCELADA', aviso: avisoTec });
      if (out.visita) realtime.emitToUser(out.previous.id_tecnico, 'billetera.actualizada', { id_solicitud: Number(out.row.id_solicitud) });
      sendPush(out.previous.id_tecnico, 'Servicio cancelado', avisoTec);
    }
  } else {
    const devolucion = out.reembolso ? ` Te devolveremos $${Number(out.reembolso).toFixed(2)} que pagaste en custodia.` : '';
    S.notify(out.row, `Tu técnico tuvo que cancelar. Estamos buscando otro técnico disponible.${devolucion}`, { push: [[out.row.id_usuario, 'Buscando otro técnico']] });
    reasignar(out.row);
  }
  const cargoTxt = out.visita ? ` Se cobró $${Number(out.visita.cargo).toFixed(2)} por la visita del técnico.` : '';
  const mensajeCliente = out.reembolso
    ? `Solicitud cancelada.${cargoTxt} Te devolveremos $${Number(out.reembolso).toFixed(2)} que pagaste en custodia.`
    : out.visita ? `Solicitud cancelada.${cargoTxt}` : 'Solicitud cancelada sin cargo.';

  // Escala de sanciones: cancelar después de intentar compartir contacto en el chat de esta orden es un
  // intento directo de sacar el trato de la app → al menos nivel 2 (24 h).
  let sancion = null;
  const compartio = await db().query(
    'SELECT 1 FROM infracciones WHERE id_usuario = $1 AND id_solicitud = $2 AND tipo = $3 LIMIT 1',
    [req.user.id_usuario, out.row.id_solicitud, sanciones.TIPOS.CHAT_CONTACTO]
  );
  if (compartio.rowCount) {
    sancion = await sanciones.registrarInfraccion({
      idUsuario: req.user.id_usuario, tipo: sanciones.TIPOS.CANCELACION_TRAS_CONTACTO, idSolicitud: out.row.id_solicitud, nivelMinimo: 2,
    });
  }
  // Stripe: lo que quedó por devolver se reembolsa a la tarjeta en automático.
  if (out.reembolso) stripePagos.procesarReembolsos(out.row.id_solicitud).catch((error) => console.error('Reembolso automático:', error.message));
  res.json({ mensaje: out.by === 'CLIENTE' ? mensajeCliente : 'Cancelaste el servicio. Lo reasignaremos a otro técnico.', solicitud: S.shape(out.row, req.user), sancion });
}

router.post('/api/solicitudes/:id/cancelar', auth, cancelRequest);

// ───────────────────────── SOS (RF-100) ─────────────────────────
router.post('/api/solicitudes/:id/sos', auth, idempotent('solicitud.sos'), async (req, res) => {
  const row = await S.findRow(req.params.id);
  if (!row || (row.id_usuario !== req.user.id_usuario && row.id_tecnico !== req.user.id_usuario)) {
    return fail(res, 404, 'NOT_FOUND', 'Solicitud no encontrada.');
  }
  const lat = parseCoord(req.body?.latitud ?? req.body?.latitud_sos, -90, 90);
  const lng = parseCoord(req.body?.longitud ?? req.body?.longitud_sos, -180, 180);
  const incidencia = await withTransaction(async (tx) => {
    await tx.query(
      'UPDATE solicitudes_servicio SET alerta_sos = true, latitud_sos = $1, longitud_sos = $2, fecha_sos = NOW() WHERE id_solicitud = $3',
      [lat, lng, row.id_solicitud]
    );
    const open = await tx.query("SELECT id_incidencia, folio FROM incidencias WHERE id_solicitud = $1 AND tipo = 'SEGURIDAD' AND estado = 'ABIERTA'", [row.id_solicitud]);
    if (open.rows[0]) return open.rows[0];
    const created = await tx.query(
      `INSERT INTO incidencias (folio, id_solicitud, id_usuario, tipo, descripcion, prioridad)
       VALUES ($1, $2, $3, 'SEGURIDAD', $4, 'ALTA') RETURNING id_incidencia, folio`,
      [S.folio('INC'), row.id_solicitud, req.user.id_usuario, `Alerta SOS activada${lat != null ? ` en ${lat}, ${lng}` : ''}.`]
    );
    return created.rows[0];
  });
  console.error(`ALERTA SOS · solicitud ${row.folio} · usuario ${req.user.id_usuario} · ubicación ${lat}, ${lng} · incidencia ${incidencia.folio}`);
  audit(req, 'SOS', 'solicitud', row.id_solicitud, { latitud: lat, longitud: lng });
  res.json({ mensaje: 'Alerta SOS enviada. El equipo de seguridad de Click & Serve ya tiene tu ubicación.', incidencia });
});

// ───────────────────────── Chat del servicio (RF-108, RF-112) ─────────────────────────
async function chatAccess(req) {
  const row = await S.findRow(req.params.id);
  if (!row || (row.id_usuario !== req.user.id_usuario && row.id_tecnico !== req.user.id_usuario)) {
    throw new HttpError(403, 'FORBIDDEN', 'No tienes acceso a este chat.');
  }
  return row;
}

// Anti-evasión: el chat del servicio se abre solo cuando el cliente pagó el precio base en custodia.
// Las órdenes que ya tuvieron custodia (aunque luego se cancelaran) conservan el historial para lectura.
const chatBloqueado = (row) => !row.direccion_liberada && !row.custodia_estado;
const MENSAJE_CHAT_BLOQUEADO = 'El chat se abre cuando el cliente paga el precio base del servicio en custodia.';

function shapeMessage(m) {
  return {
    id: Number(m.id),
    id_solicitud: Number(m.id_solicitud),
    id_emisor: m.id_emisor,
    emisor_nombre: m.emisor_nombre,
    mensaje: m.mensaje,
    adjunto_url: m.id_archivo ? signFileUrl(m.id_archivo) : null,
    adjunto_tipo: m.tipo_mime || null,
    adjunto_nombre: m.nombre_archivo || null,
    fecha_envio: m.fecha_envio,
  };
}

router.get('/api/solicitudes/:id/chat', auth, async (req, res) => {
  const row = await chatAccess(req);
  if (chatBloqueado(row)) return res.json({ mensajes: [], politicas_aceptadas: false, bloqueado: true, aviso: MENSAJE_CHAT_BLOQUEADO });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
  const { rows } = await db().query(
    `SELECT * FROM (
       SELECT m.id, m.id_solicitud, m.id_emisor, m.mensaje, m.fecha_envio, m.id_archivo, u.nombre AS emisor_nombre,
              a.tipo_mime, a.nombre AS nombre_archivo
       FROM mensajes_chat m JOIN usuarios u ON u.id_usuario = m.id_emisor LEFT JOIN archivos a ON a.id_archivo = m.id_archivo
       WHERE m.id_solicitud = $1 ORDER BY m.fecha_envio DESC LIMIT $2) x ORDER BY fecha_envio ASC`,
    [row.id_solicitud, limit]
  );
  const politicas_aceptadas = await politicasAceptadas(req.user.id_usuario, TIPO_CHAT.SOLICITUD, row.id_solicitud);
  res.json({ mensajes: rows.map(shapeMessage), politicas_aceptadas });
});

// Chat seguro: el participante acepta las reglas de su rol antes de poder escribir.
router.post('/api/solicitudes/:id/chat/politicas', auth, async (req, res) => {
  const row = await chatAccess(req);
  await aceptarPoliticas(req.user.id_usuario, TIPO_CHAT.SOLICITUD, row.id_solicitud);
  audit(req, 'CHAT_POLITICAS_ACEPTADAS', 'solicitud', row.id_solicitud, { version: POLITICAS_VERSION });
  res.json({ politicas_aceptadas: true, version: POLITICAS_VERSION });
});

router.post('/api/solicitudes/:id/chat', auth, uploader({ types: DOCUMENT_TYPES, maxFiles: 1, maxSizeMb: 8 }).single('adjunto'), filtroChatSeguro, async (req, res) => {
  const row = await chatAccess(req);
  if (chatBloqueado(row) || !row.direccion_liberada) return fail(res, 409, 'CHAT_LOCKED', MENSAJE_CHAT_BLOQUEADO);
  await exigirPoliticas(req.user.id_usuario, TIPO_CHAT.SOLICITUD, row.id_solicitud);
  const mensaje = sanitizeText(req.body?.mensaje, 2000) || null;
  if (!mensaje && !req.file) return fail(res, 400, 'VALIDATION_ERROR', 'El mensaje no puede estar vacío.');
  const saved = await withTransaction(async (tx) => {
    const idArchivo = req.file
      ? await saveFile(tx, { owner: req.user.id_usuario, buffer: req.file.buffer, mime: req.file.mimetype, name: req.file.originalname, categoria: 'CHAT' })
      : null;
    const { rows } = await tx.query(
      `INSERT INTO mensajes_chat (id_solicitud, id_emisor, mensaje, id_archivo) VALUES ($1, $2, $3, $4)
       RETURNING id, id_solicitud, id_emisor, mensaje, fecha_envio, id_archivo`,
      [row.id_solicitud, req.user.id_usuario, mensaje, idArchivo]
    );
    return { ...rows[0], emisor_nombre: req.user.nombre, tipo_mime: req.file?.mimetype, nombre_archivo: req.file?.originalname };
  });
  const message = shapeMessage(saved);
  const receptor = req.user.id_usuario === row.id_usuario ? row.id_tecnico : row.id_usuario;
  realtime.emitToUsers([row.id_usuario, row.id_tecnico], 'chat.mensaje', message);
  sendPush(receptor, `Mensaje de ${req.user.nombre}`, mensaje || 'Te envió un archivo', { id_solicitud: Number(row.id_solicitud), tipo: 'chat' });
  // Escala de sanciones: cada mensaje bloqueado es un intento de desintermediación (nivel 1 = solo el aviso).
  let sancion = null;
  if (req.chatFiltro.bloqueado) {
    audit(req, 'CHAT_FILTRADO', 'solicitud', row.id_solicitud, { motivos: req.chatFiltro.motivos });
    sancion = await sanciones.registrarInfraccion({ idUsuario: req.user.id_usuario, tipo: sanciones.TIPOS.CHAT_CONTACTO, idSolicitud: row.id_solicitud, detalle: { motivos: req.chatFiltro.motivos } });
  }
  res.status(201).json({ mensaje: message, filtrado: { ...req.chatFiltro, sancion } });
});

module.exports = router;
module.exports.cancelRequest = cancelRequest;
