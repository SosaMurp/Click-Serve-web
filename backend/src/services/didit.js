const { fetchWithTimeout } = require('./payments');
const { parseCurp, findCurp, curpMatchesName } = require('../lib/ine/curp');
const { namesMatch, normalizeName } = require('../lib/ine/nombres');
const { isDevelopment } = require('../lib/env');

// Verificación de la INE con Didit (https://docs.didit.me/standalone-apis/id-verification):
// POST /v3/id-verification/ con el frente y el reverso. Didit lee el documento, valida la MRZ y detecta
// fotos de pantallas, copias impresas y retratos alterados. Aquí además se compara lo que Didit leyó con
// el nombre y la fecha de nacimiento que la persona escribió en el registro.
// Se activa con DIDIT_API_KEY; sin llave se usa la verificación propia (services/ineVerifier.js).

const URL_DEFAULT = 'https://verification.didit.me/v3/id-verification/';
const TIMEOUT_MS = 30000;

function isEnabled() {
  return Boolean(process.env.DIDIT_API_KEY);
}

// Sandbox de Didit (llave sk_test_): no lee la foto, siempre responde una persona ficticia ("Sandbox User", USA).
// Solo en desarrollo se acepta su resultado sin comparar país, nombre ni fecha, para poder probar el registro.
function esSandbox() {
  return isDevelopment() && String(process.env.DIDIT_API_KEY || '').startsWith('sk_test_');
}

const MOTIVOS = {
  noIne: 'No reconocimos una credencial del INE. Toma las fotos de tu credencial física completa, con las cuatro esquinas visibles.',
  noMexicana: 'Usa tu credencial para votar del INE.',
  vencida: 'Tu credencial está vencida. Usa una credencial vigente.',
  copia: 'Toma la foto de tu credencial física, no de una pantalla ni de una copia impresa.',
  ilegible: 'No pudimos leer bien tu credencial. Tómala otra vez con buena luz, sin reflejos y con las cuatro esquinas visibles.',
  datos: 'Los datos de la credencial no coinciden con los que escribiste. Revisa tu nombre y fecha de nacimiento, o usa tu propia credencial.',
  revision: 'No pudimos confirmar tu credencial en este momento. Toma las fotos otra vez.',
  servicio: 'El servicio de verificación de identidad no está disponible. Intenta en unos minutos.',
};

// Motivo para la persona según los avisos de Didit (log_type "error" son los que rechazan).
const RIESGOS = {
  DOCUMENT_EXPIRED: MOTIVOS.vencida,
  SCREEN_CAPTURE_DETECTED: MOTIVOS.copia,
  PRINTED_COPY_DETECTED: MOTIVOS.copia,
  PORTRAIT_MANIPULATION_DETECTED: MOTIVOS.copia,
  PUBLIC_DOCUMENT_IMAGE_DETECTED: MOTIVOS.copia,
  COULD_NOT_DETECT_DOCUMENT_TYPE: MOTIVOS.noIne,
  NAME_NOT_DETECTED: MOTIVOS.ilegible,
  DATE_OF_BIRTH_NOT_DETECTED: MOTIVOS.ilegible,
  DOCUMENT_NUMBER_NOT_DETECTED: MOTIVOS.ilegible,
  MRZ_VALIDATION_FAILED: MOTIVOS.ilegible,
  DATA_INCONSISTENT: MOTIVOS.ilegible,
};

class DiditError extends Error {
  constructor(motivo, { status, unavailable = false } = {}) {
    super(motivo);
    this.status = status;
    this.unavailable = unavailable;
  }
}

// Llama a Didit con las dos caras. Devuelve el JSON de la respuesta 200 o lanza DiditError.
// save_api_request=false: Didit no guarda las imágenes ni la sesión (minimización de datos personales);
// con DIDIT_SAVE_REQUESTS=true se guardan y se pueden revisar en su consola.
function formulario({ frente, reverso, vendorData }) {
  const form = new FormData();
  form.append('front_image', new Blob([frente.buffer], { type: frente.mimetype || 'image/jpeg' }), 'ine_frente.jpg');
  form.append('back_image', new Blob([reverso.buffer], { type: reverso.mimetype || 'image/jpeg' }), 'ine_reverso.jpg');
  form.append('perform_document_liveness', 'true');
  form.append('save_api_request', process.env.DIDIT_SAVE_REQUESTS === 'true' ? 'true' : 'false');
  if (vendorData) form.append('vendor_data', vendorData);
  return form;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function verificarDocumento({ frente, reverso, vendorData }) {
  let resp;
  // 503 document_processing_busy: Didit pide reenviar el mismo archivo; se reintenta una vez (máx. 3 s de espera).
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      resp = await fetchWithTimeout(process.env.DIDIT_API_URL || URL_DEFAULT, {
        method: 'POST',
        headers: { 'x-api-key': process.env.DIDIT_API_KEY },
        body: formulario({ frente, reverso, vendorData }),
      }, TIMEOUT_MS);
    } catch {
      throw new DiditError(MOTIVOS.servicio, { unavailable: true });
    }
    if (resp.status !== 503 || intento === 1) break;
    await espera(Math.min(3000, (Number(resp.headers.get('retry-after')) || 1) * 1000));
  }
  const body = await resp.json().catch(() => ({}));
  if (resp.ok) return body;
  // 400 COULD_NOT_RECOGNIZE_DOCUMENT: la foto no es un documento. Es un rechazo, no una falla del servicio.
  if (resp.status === 400 && body?.error === 'COULD_NOT_RECOGNIZE_DOCUMENT') throw new DiditError(MOTIVOS.noIne, { status: 400 });
  if (resp.status === 400) throw new DiditError(MOTIVOS.ilegible, { status: 400 });
  // 401/403: llave inválida o sin créditos; 429: límite; 5xx: caída. La persona no puede corregirlo.
  console.error(`Didit respondió ${resp.status}:`, JSON.stringify(body).slice(0, 300));
  throw new DiditError(MOTIVOS.servicio, { status: resp.status, unavailable: true });
}

const result = (id, ok, detalle) => ({ id, ok, detalle });

// CURP en los datos que devuelve Didit (número personal, número de documento o campos extra).
function curpDe(v) {
  const candidatos = [v.personal_number, v.document_number, ...Object.values(v.extra_fields || {})]
    .filter((x) => typeof x === 'string');
  for (const c of candidatos) {
    const curp = findCurp(normalizeName(c));
    const datos = curp ? parseCurp(curp) : null;
    if (datos) return datos;
  }
  return null;
}

// Decide si la credencial que leyó Didit es válida y corresponde a la persona que se registra.
// registro: { nombre, apellidos, fecha_nacimiento } escritos por la persona.
function evaluarRespuesta(body, registro, hoy = new Date().toISOString().slice(0, 10), { sandbox = false } = {}) {
  const v = body?.id_verification || {};
  const errores = (v.warnings || []).filter((w) => w.log_type === 'error').map((w) => w.risk);
  const checks = [result('didit', v.status === 'Approved', `Didit: ${v.status || 'sin resultado'}${errores.length ? ` (${errores.join(', ')})` : ''}.`)];

  if (v.status !== 'Approved') {
    const motivo = errores.map((r) => RIESGOS[r]).find(Boolean) || (v.status === 'In Review' ? MOTIVOS.revision : MOTIVOS.ilegible);
    return { ok: false, comprobaciones: checks, motivo };
  }

  // Modo de prueba: los datos de Didit son ficticios; se usan los del registro para que el flujo continúe.
  if (sandbox) {
    checks.push(result('sandbox', true, 'Modo de prueba de Didit (Sandbox): no se comparan país, nombre ni fecha de nacimiento.'));
    return {
      ok: true,
      comprobaciones: checks,
      datos: {
        curp: null, documento: body.request_id, sexo: null,
        fecha_nacimiento: registro.fecha_nacimiento, vigencia: null, referencia: body.request_id || null,
      },
    };
  }

  const mexicana = v.issuing_state === 'MEX';
  checks.push(result('pais', mexicana, `Documento emitido por ${v.issuing_state_name || v.issuing_state || 'un país no identificado'}.`));
  if (!mexicana) return { ok: false, comprobaciones: checks, motivo: MOTIVOS.noMexicana };

  const nombreLeido = v.full_name || [v.first_name, v.last_name].filter(Boolean).join(' ');
  checks.push(result('fecha_nacimiento', v.date_of_birth === registro.fecha_nacimiento, 'La fecha de nacimiento de la credencial se compara con la del registro.'));
  checks.push(result('nombre', !!nombreLeido && namesMatch(normalizeName(nombreLeido), `${registro.nombre} ${registro.apellidos}`), 'El nombre de la credencial se compara con el registrado.'));
  const curp = curpDe(v);
  if (curp) checks.push(result('curp', curpMatchesName(curp.curp, registro), 'Las iniciales de la CURP se comparan con el nombre registrado.'));
  if (v.expiration_date) checks.push(result('vigencia', v.expiration_date >= hoy, `Vigente hasta ${v.expiration_date}.`));

  const ok = checks.every((c) => c.ok);
  const vencida = checks.some((c) => c.id === 'vigencia' && !c.ok);
  return {
    ok,
    comprobaciones: checks,
    motivo: ok ? undefined : vencida ? MOTIVOS.vencida : MOTIVOS.datos,
    datos: ok ? {
      curp: curp?.curp || null,
      // Identificador del documento para ligar los dos lados en el registro: la CURP si se leyó, si no el número.
      documento: curp?.curp || v.document_number || v.personal_number || body.request_id,
      sexo: v.gender === 'F' ? 'M' : v.gender === 'M' ? 'H' : null,
      fecha_nacimiento: v.date_of_birth,
      vigencia: v.expiration_date || null,
      referencia: body.request_id || null,
    } : undefined,
  };
}

module.exports = { isEnabled, esSandbox, verificarDocumento, evaluarRespuesta, DiditError, MOTIVOS };
