const { getPool, withTransaction } = require('../db/pool');
const { fetchWithTimeout } = require('./payments');
const realtime = require('../lib/realtime');
const { audit } = require('../lib/audit');

// Validación de la cédula profesional contra el Registro Nacional de Profesionistas (SEP).
// La consulta corre en segundo plano: la petición solo deja la cédula en EN_PROCESO y la app recibe el
// resultado por WebSocket (evento `cedula.validada`) o al volver a cargar su perfil.

const SEP_URL_DEFAULT = 'https://www.cedulaprofesional.sep.gob.mx/cedula/buscaCedulaJson.action';
const SEP_TIMEOUT_MS = 5000;

// Estados que guarda usuarios.estado_cedula.
const ESTADO = {
  EN_PROCESO: 'EN_PROCESO',
  VERIFICADA: 'VERIFICADA',
  NO_VERIFICADA: 'NO_VERIFICADA',
  NO_DISPONIBLE: 'NO_DISPONIBLE',
};

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// Identificador especial: único por técnico y estable (no cambia si la cédula se vuelve a validar).
function folioProfesional(idUsuario) {
  return `CSP-${String(idUsuario).padStart(6, '0')}`;
}

// Comparación pura, sin red ni base de datos, para poder probarla por separado.
// 1. Existencia: la SEP devuelve al menos un registro para la cédula.
// 2. Nombre: el primer nombre y el primer apellido coinciden con los de la cuenta.
// 3. Vigencia: las cédulas profesionales no caducan; si el registro trae un estatus de baja o cancelación,
//    se rechaza. Si la SEP no envía ese campo, no se puede comprobar y solo se revisan los puntos 1 y 2.
function evaluarCedula(items, { nombre, apellido }) {
  const registros = Array.isArray(items) ? items : [];
  if (!registros.length) return { ok: false, codigo: 'NO_EXISTE', motivo: 'La SEP no encontró una cédula con ese número.' };

  const primerNombre = normalize(nombre).split(/\s+/)[0];
  const primerApellido = normalize(apellido).split(/\s+/)[0];
  const coincide = registros.find((it) => normalize(it.nombre).split(/\s+/).includes(primerNombre) && normalize(it.paterno) === primerApellido);
  if (!coincide) {
    return { ok: false, codigo: 'NOMBRE_NO_COINCIDE', motivo: 'La cédula no coincide con tu nombre en el Registro Nacional de Profesionistas.' };
  }

  const estatus = normalize(coincide.estatus || coincide.estado || '');
  if (/CANCEL|SUSPEN|BAJA/.test(estatus) || coincide.vigente === false) {
    return { ok: false, codigo: 'NO_VIGENTE', motivo: 'La cédula aparece dada de baja o suspendida en la SEP.' };
  }

  return { ok: true, titulo: coincide.titulo ? String(coincide.titulo).slice(0, 150) : null };
}

async function consultarSep(cedula) {
  const url = process.env.SEP_URL || SEP_URL_DEFAULT;
  const body = new URLSearchParams({ json: JSON.stringify({ maxResult: '1000', nombre: '', paterno: '', materno: '', idCedula: cedula }) });
  const resp = await fetchWithTimeout(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, SEP_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`SEP ${resp.status}`);
  return (await resp.json()).items || [];
}

// Marca la cédula como EN_PROCESO antes de responder. Si ya estaba verificada, no se vuelve a consultar.
async function iniciarValidacion(usuario) {
  const { rows } = await getPool().query(
    `UPDATE usuarios SET estado_cedula = $2
     WHERE id_usuario = $1 AND COALESCE(verificado_sep, false) = false
     RETURNING id_usuario`,
    [usuario.id_usuario, ESTADO.EN_PROCESO]
  );
  return rows.length > 0;
}

// Se llama sin await desde la ruta: el resultado llega por WebSocket y queda guardado en la base.
function validarEnSegundoPlano(usuario, cedula, req) {
  setImmediate(() => {
    procesarValidacion(usuario, cedula, req).catch((error) => {
      console.error('No se pudo validar la cédula en segundo plano:', error.message);
    });
  });
}

async function procesarValidacion(usuario, cedula, req) {
  const db = getPool();
  let items;
  try {
    items = await consultarSep(cedula);
  } catch {
    await db.query(
      "INSERT INTO documentos_usuario (id_usuario, tipo, numero, descripcion) VALUES ($1, 'CEDULA', $2, 'Pendiente de validar con la SEP')",
      [usuario.id_usuario, cedula]
    );
    await db.query('UPDATE usuarios SET estado_cedula = $2 WHERE id_usuario = $1', [usuario.id_usuario, ESTADO.NO_DISPONIBLE]);
    return emitir(usuario, { estado: ESTADO.NO_DISPONIBLE, verificado_sep: false, mensaje: 'El registro de la SEP no está disponible. Guardamos tu cédula para revisarla después.' });
  }

  const resultado = evaluarCedula(items, { nombre: usuario.nombre, apellido: usuario.apellido });
  if (!resultado.ok) {
    await db.query('UPDATE usuarios SET estado_cedula = $2 WHERE id_usuario = $1', [usuario.id_usuario, ESTADO.NO_VERIFICADA]);
    return emitir(usuario, { estado: ESTADO.NO_VERIFICADA, verificado_sep: false, motivo: resultado.codigo, mensaje: resultado.motivo });
  }

  const folio = folioProfesional(usuario.id_usuario);
  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE usuarios SET verificado_sep = true, estado_cedula = $2, folio_profesional = COALESCE(folio_profesional, $3)
       WHERE id_usuario = $1`,
      [usuario.id_usuario, ESTADO.VERIFICADA, folio]
    );
    await tx.query(
      "INSERT INTO documentos_usuario (id_usuario, tipo, numero, descripcion, estado) VALUES ($1, 'CEDULA', $2, $3, 'APROBADO')",
      [usuario.id_usuario, cedula, resultado.titulo || 'Cédula profesional']
    );
  });
  audit(req, 'CEDULA_VALIDADA', 'usuario', usuario.id_usuario, { cedula, folio });
  return emitir(usuario, {
    estado: ESTADO.VERIFICADA,
    verificado_sep: true,
    folio_profesional: folio,
    titulo: resultado.titulo,
    mensaje: 'Cédula validada con la SEP. Ya tienes la insignia de profesionista.',
  });
}

function emitir(usuario, data) {
  realtime.emitToUser(usuario.id_usuario, 'cedula.validada', data);
}

module.exports = { ESTADO, evaluarCedula, folioProfesional, iniciarValidacion, validarEnSegundoPlano };
