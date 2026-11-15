const express = require('express');
const { getPool, withTransaction } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole, requireApproved } = require('../middleware/roles');
const { fail } = require('../lib/http');
const { sanitizeText } = require('../lib/sanitize');
const { saveFile, uploader, signFileUrl, DOCUMENT_TYPES } = require('../lib/files');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { audit } = require('../lib/audit');
const { filtroChatSeguro } = require('../middleware/chatFilter');
const sanciones = require('../services/sanciones');
const { VERSION: POLITICAS_VERSION, TIPO: TIPO_CHAT, politicasAceptadas, aceptarPoliticas, exigirPoliticas } = require('../services/chatPoliticas');

// Mensajes directos cliente → técnico (búsqueda de técnicos). Solo el cliente abre la conversación;
// después ambos pueden escribirse. El técnico debe estar visible en la búsqueda (cuenta aprobada e identidad verificada).

const router = express.Router();
const db = () => getPool();
const clienteOnly = [auth, requireRole(ROL.CLIENTE), requireApproved];

const EVENTO = 'chat.directo.mensaje';

// Anti-evasión: el chat directo es solo para dudas antes de contratar. Cada persona puede mandar pocos mensajes
// por conversación (ventana de 30 días); para seguir, el cliente pide el servicio a ese técnico y platican en el
// chat del servicio, que se abre al pagar el precio base. Así no se puede cerrar el trato por fuera antes de pagar.
const LIMITE_SIN_SERVICIO = 3;
const VENTANA_DIAS = 30;

async function mensajesRestantes(idConversacion, idUsuario, q = db()) {
  const { rows: [r] } = await q.query(
    `SELECT COUNT(*)::int AS n FROM mensajes_directos
     WHERE id_conversacion = $1 AND id_emisor = $2 AND fecha_envio > NOW() - make_interval(days => $3::int)`,
    [idConversacion, idUsuario, VENTANA_DIAS]
  );
  return Math.max(0, LIMITE_SIN_SERVICIO - r.n);
}

const TECNICO_VISIBLE = `u.id_rol = ${ROL.TECNICO} AND u.anonimizado = false AND u.identidad_verificada = true
  AND UPPER(COALESCE(u.estado_cuenta, '')) IN ('ACTIVO', 'APROBADO')`;

function shapeMessage(m) {
  return {
    id: Number(m.id),
    id_conversacion: Number(m.id_conversacion),
    id_emisor: m.id_emisor,
    emisor_nombre: m.emisor_nombre,
    mensaje: m.mensaje,
    adjunto_url: m.id_archivo ? signFileUrl(m.id_archivo) : null,
    adjunto_tipo: m.tipo_mime || null,
    adjunto_nombre: m.nombre_archivo || null,
    fecha_envio: m.fecha_envio,
  };
}

// La conversación debe existir y el usuario debe ser una de sus dos partes.
async function conversacionDeParticipante(idConversacion, idUsuario) {
  const { rows } = await db().query(
    'SELECT id_conversacion, id_cliente, id_tecnico FROM conversaciones_directas WHERE id_conversacion = $1',
    [idConversacion]
  );
  const row = rows[0];
  if (!row || (row.id_cliente !== idUsuario && row.id_tecnico !== idUsuario)) {
    return null;
  }
  return row;
}

// Abre (o reutiliza) la conversación con un técnico visible en la búsqueda.
router.post('/api/chat-directo', ...clienteOnly, async (req, res) => {
  const idTecnico = Number(req.body?.id_tecnico);
  if (!Number.isInteger(idTecnico) || idTecnico <= 0) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Indica el técnico con el que quieres escribir.', { field: 'id_tecnico' });
  }
  if (idTecnico === req.user.id_usuario) {
    return fail(res, 400, 'VALIDATION_ERROR', 'No puedes escribirte a ti mismo.', { field: 'id_tecnico' });
  }
  const { rows: tecnicos } = await db().query(`SELECT u.id_usuario FROM usuarios u WHERE u.id_usuario = $1 AND ${TECNICO_VISIBLE}`, [idTecnico]);
  if (!tecnicos[0]) return fail(res, 404, 'NOT_FOUND', 'Técnico no disponible para mensajes.');

  const { rows } = await db().query(
    `INSERT INTO conversaciones_directas (id_cliente, id_tecnico) VALUES ($1, $2)
     ON CONFLICT (id_cliente, id_tecnico) DO UPDATE SET id_cliente = EXCLUDED.id_cliente
     RETURNING id_conversacion, id_cliente, id_tecnico`,
    [req.user.id_usuario, idTecnico]
  );
  res.status(201).json({ conversacion: { id_conversacion: Number(rows[0].id_conversacion), id_tecnico: idTecnico } });
});

// Conversaciones del usuario (cliente o técnico), con el último mensaje.
router.get('/api/chat-directo', auth, async (req, res) => {
  const { rows } = await db().query(
    `SELECT c.id_conversacion, c.id_cliente, c.id_tecnico,
            o.id_usuario AS otro_id, o.nombre AS otro_nombre, o.apellido AS otro_apellido, o.foto_archivo AS otro_foto,
            ult.mensaje AS ultimo_mensaje, ult.fecha_envio AS ultima_fecha
     FROM conversaciones_directas c
     JOIN usuarios o ON o.id_usuario = CASE WHEN c.id_cliente = $1 THEN c.id_tecnico ELSE c.id_cliente END
     LEFT JOIN LATERAL (
       SELECT m.mensaje, m.fecha_envio FROM mensajes_directos m WHERE m.id_conversacion = c.id_conversacion
       ORDER BY m.fecha_envio DESC LIMIT 1
     ) ult ON true
     WHERE c.id_cliente = $1 OR c.id_tecnico = $1
     ORDER BY COALESCE(ult.fecha_envio, c.fecha_creacion) DESC
     LIMIT 100`,
    [req.user.id_usuario]
  );
  res.json({
    conversaciones: rows.map((r) => ({
      id_conversacion: Number(r.id_conversacion),
      otro: {
        id_usuario: r.otro_id,
        nombre: r.otro_nombre,
        apellido: r.otro_apellido,
        foto_url: r.otro_foto ? signFileUrl(r.otro_foto, 3600) : null,
      },
      ultimo_mensaje: r.ultimo_mensaje,
      fecha: r.ultima_fecha,
    })),
  });
});

router.get('/api/chat-directo/:id/mensajes', auth, async (req, res) => {
  const conv = await conversacionDeParticipante(req.params.id, req.user.id_usuario);
  if (!conv) return fail(res, 403, 'FORBIDDEN', 'No tienes acceso a esta conversación.');
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
  const { rows } = await db().query(
    `SELECT * FROM (
       SELECT m.id, m.id_conversacion, m.id_emisor, m.mensaje, m.fecha_envio, m.id_archivo, u.nombre AS emisor_nombre,
              a.tipo_mime, a.nombre AS nombre_archivo
       FROM mensajes_directos m JOIN usuarios u ON u.id_usuario = m.id_emisor LEFT JOIN archivos a ON a.id_archivo = m.id_archivo
       WHERE m.id_conversacion = $1 ORDER BY m.fecha_envio DESC LIMIT $2) x ORDER BY fecha_envio ASC`,
    [conv.id_conversacion, limit]
  );
  const politicas_aceptadas = await politicasAceptadas(req.user.id_usuario, TIPO_CHAT.DIRECTO, conv.id_conversacion);
  res.json({
    mensajes: rows.map(shapeMessage),
    politicas_aceptadas,
    id_tecnico: conv.id_tecnico,
    limite: LIMITE_SIN_SERVICIO,
    restantes: await mensajesRestantes(conv.id_conversacion, req.user.id_usuario),
  });
});

// Chat seguro: el participante acepta las reglas de su rol antes de poder escribir.
router.post('/api/chat-directo/:id/politicas', auth, async (req, res) => {
  const conv = await conversacionDeParticipante(req.params.id, req.user.id_usuario);
  if (!conv) return fail(res, 403, 'FORBIDDEN', 'No tienes acceso a esta conversación.');
  await aceptarPoliticas(req.user.id_usuario, TIPO_CHAT.DIRECTO, conv.id_conversacion);
  audit(req, 'CHAT_POLITICAS_ACEPTADAS', 'conversacion_directa', conv.id_conversacion, { version: POLITICAS_VERSION });
  res.json({ politicas_aceptadas: true, version: POLITICAS_VERSION });
});

router.post('/api/chat-directo/:id/mensajes', auth, uploader({ types: DOCUMENT_TYPES, maxFiles: 1, maxSizeMb: 8 }).single('adjunto'), filtroChatSeguro, async (req, res) => {
  const conv = await conversacionDeParticipante(req.params.id, req.user.id_usuario);
  if (!conv) return fail(res, 403, 'FORBIDDEN', 'No tienes acceso a esta conversación.');
  await exigirPoliticas(req.user.id_usuario, TIPO_CHAT.DIRECTO, conv.id_conversacion);
  const mensaje = sanitizeText(req.body?.mensaje, 2000) || null;
  if (!mensaje && !req.file) return fail(res, 400, 'VALIDATION_ERROR', 'El mensaje no puede estar vacío.');
  if ((await mensajesRestantes(conv.id_conversacion, req.user.id_usuario)) === 0) {
    const texto = req.user.id_usuario === conv.id_cliente
      ? `El chat directo es solo para dudas antes de contratar (${LIMITE_SIN_SERVICIO} mensajes). Para seguir, pide el servicio a este técnico: el chat del servicio se abre al pagar el precio base.`
      : `El chat directo es solo para dudas antes de contratar (${LIMITE_SIN_SERVICIO} mensajes). Para seguir, el cliente debe pedirte el servicio desde la app.`;
    return fail(res, 409, 'CHAT_DIRECTO_LIMITE', texto, { restantes: 0 });
  }

  const saved = await withTransaction(async (tx) => {
    const idArchivo = req.file
      ? await saveFile(tx, { owner: req.user.id_usuario, buffer: req.file.buffer, mime: req.file.mimetype, name: req.file.originalname, categoria: 'CHAT' })
      : null;
    const { rows } = await tx.query(
      `INSERT INTO mensajes_directos (id_conversacion, id_emisor, mensaje, id_archivo) VALUES ($1, $2, $3, $4)
       RETURNING id, id_conversacion, id_emisor, mensaje, fecha_envio, id_archivo`,
      [conv.id_conversacion, req.user.id_usuario, mensaje, idArchivo]
    );
    return { ...rows[0], emisor_nombre: req.user.nombre, tipo_mime: req.file?.mimetype, nombre_archivo: req.file?.originalname };
  });

  const message = shapeMessage(saved);
  const receptor = req.user.id_usuario === conv.id_cliente ? conv.id_tecnico : conv.id_cliente;
  realtime.emitToUsers([conv.id_cliente, conv.id_tecnico], EVENTO, message);
  sendPush(receptor, `Mensaje de ${req.user.nombre}`, mensaje || 'Te envió un archivo', { id_conversacion: Number(conv.id_conversacion), tipo: 'chat_directo' });
  // Escala de sanciones: cada mensaje bloqueado es un intento de desintermediación (nivel 1 = solo el aviso).
  let sancion = null;
  if (req.chatFiltro.bloqueado) {
    audit(req, 'CHAT_FILTRADO', 'conversacion_directa', conv.id_conversacion, { motivos: req.chatFiltro.motivos });
    sancion = await sanciones.registrarInfraccion({ idUsuario: req.user.id_usuario, tipo: sanciones.TIPOS.CHAT_CONTACTO, idConversacion: conv.id_conversacion, detalle: { motivos: req.chatFiltro.motivos } });
  }
  res.status(201).json({ mensaje: message, filtrado: { ...req.chatFiltro, sancion }, restantes: await mensajesRestantes(conv.id_conversacion, req.user.id_usuario) });
});

module.exports = router;
