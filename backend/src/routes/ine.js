const express = require('express');
const { rateLimit } = require('../middleware/rateLimit');
const { fail } = require('../lib/http');
const { uploader } = require('../lib/files');
const { sanitizeText } = require('../lib/sanitize');
const { signTicket, readTicket, registroKey, sha256 } = require('../lib/ine/ticket');
const { verifyIne, analyzeQuality } = require('../services/ineVerifier');
const didit = require('../services/didit');

const router = express.Router();
// Cada foto que toma la app es un intento; en web el disparo es automático, así que el margen es amplio.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

const calidadCheck = (calidad) => ({ id: 'calidad', ok: calidad.ok, detalle: calidad.ok ? 'Foto nítida y con buena luz.' : calidad.motivo });

// RF-25: la app manda cada lado de la INE al tomar la foto, antes de crear la cuenta (por eso es pública).
// Si pasa, devuelve un ticket firmado y ligado a esa imagen, que POST /api/register exige.
// Con DIDIT_API_KEY la verificación la hace Didit con las dos caras juntas: el frente solo revisa la calidad
// y el reverso trae también la foto del frente (campo "frente"). Sin llave, la verificación propia (OCR).
router.post(
  '/api/ine/verificar',
  limiter,
  uploader({ maxFiles: 2, maxSizeMb: 10 }).fields([{ name: 'foto', maxCount: 1 }, { name: 'frente', maxCount: 1 }]),
  async (req, res) => {
    const b = req.body || {};
    const foto = req.files?.foto?.[0];
    const lado = b.lado === 'reverso' ? 'reverso' : b.lado === 'frente' ? 'frente' : null;
    if (!lado) return fail(res, 400, 'VALIDATION_ERROR', 'Indica qué lado de la credencial es.');
    if (!foto) return fail(res, 400, 'VALIDATION_ERROR', 'Toma la foto de tu credencial.');
    const registro = {
      nombre: sanitizeText(b.nombre, 100),
      apellidos: sanitizeText(b.apellidos, 100),
      fecha_nacimiento: String(b.fecha_nacimiento || '').slice(0, 10),
    };
    if (!registro.nombre || !registro.apellidos || !/^\d{4}-\d{2}-\d{2}$/.test(registro.fecha_nacimiento)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Primero escribe tu nombre, apellidos y fecha de nacimiento.');
    }
    const persona = registroKey(registro);

    let frente = null;
    if (lado === 'reverso') {
      frente = readTicket(b.ticket_frente);
      if (!frente || frente.lado !== 'frente' || frente.persona !== persona) {
        return fail(res, 400, 'FRONT_REQUIRED', 'Primero toma la foto del frente de tu credencial.');
      }
    }

    if (didit.isEnabled()) return verificarConDidit(req, res, { lado, foto, registro, persona, frente });

    const r = await verifyIne({ buffer: foto.buffer, lado, registro, frente });
    const body = { ok: r.ok, lado, comprobaciones: r.comprobaciones, motivo: r.motivo, datos: r.datos };
    if (r.ok) {
      const curp = lado === 'frente' ? r.datos.curp : frente.curp;
      body.ticket = signTicket({
        lado,
        hash: sha256(foto.buffer),
        persona,
        curp,
        documento: curp,
        proveedor: 'propio',
        fecha_nacimiento: lado === 'frente' ? r.datos.fecha_nacimiento : frente.fecha_nacimiento,
        sexo: lado === 'frente' ? r.datos.sexo : frente.sexo,
        comprobaciones: r.comprobaciones.map(({ id, ok }) => ({ id, ok })),
      });
    }
    return res.json(body);
  }
);

async function verificarConDidit(req, res, { lado, foto, registro, persona, frente }) {
  const calidad = await analyzeQuality(foto.buffer);
  if (!calidad.ok) return res.json({ ok: false, lado, comprobaciones: [calidadCheck(calidad)], motivo: calidad.motivo });

  // Frente: solo calidad (sin costo). La credencial se verifica completa al tomar el reverso.
  if (lado === 'frente') {
    const comprobaciones = [calidadCheck(calidad)];
    return res.json({
      ok: true,
      lado,
      comprobaciones,
      ticket: signTicket({ lado, hash: sha256(foto.buffer), persona, proveedor: 'didit', comprobaciones: comprobaciones.map(({ id, ok }) => ({ id, ok })) }),
    });
  }

  // Reverso: llega con la foto del frente, que debe ser la misma que pasó la revisión de calidad.
  const fotoFrente = req.files?.frente?.[0];
  if (!fotoFrente || sha256(fotoFrente.buffer) !== frente.hash) {
    return fail(res, 400, 'FRONT_REQUIRED', 'Toma de nuevo la foto del frente de tu credencial.');
  }

  let respuesta;
  try {
    respuesta = await didit.verificarDocumento({ frente: fotoFrente, reverso: foto, vendorData: `registro:${persona.slice(0, 16)}` });
  } catch (error) {
    if (error instanceof didit.DiditError && error.unavailable) return fail(res, 503, 'IDENTITY_SERVICE_UNAVAILABLE', error.message);
    if (error instanceof didit.DiditError) {
      return res.json({ ok: false, lado, comprobaciones: [calidadCheck(calidad), { id: 'didit', ok: false, detalle: error.message }], motivo: error.message });
    }
    throw error;
  }

  const r = didit.evaluarRespuesta(respuesta, registro, undefined, { sandbox: didit.esSandbox() });
  const comprobaciones = [calidadCheck(calidad), ...r.comprobaciones];
  const body = { ok: r.ok, lado, comprobaciones, motivo: r.motivo };
  if (r.ok) {
    const resumen = comprobaciones.map(({ id, ok }) => ({ id, ok }));
    const comun = {
      persona,
      curp: r.datos.curp,
      documento: r.datos.documento,
      proveedor: 'didit',
      referencia: r.datos.referencia,
      fecha_nacimiento: r.datos.fecha_nacimiento,
      sexo: r.datos.sexo,
      comprobaciones: resumen,
    };
    body.datos = { curp: r.datos.curp, sexo: r.datos.sexo, fecha_nacimiento: r.datos.fecha_nacimiento, vigencia: r.datos.vigencia };
    body.ticket = signTicket({ ...comun, lado: 'reverso', hash: sha256(foto.buffer) });
    // El frente se vuelve a firmar con el documento verificado: el registro exige que ambos lados coincidan.
    body.ticket_frente = signTicket({ ...comun, lado: 'frente', hash: frente.hash });
  }
  return res.json(body);
}

module.exports = router;
