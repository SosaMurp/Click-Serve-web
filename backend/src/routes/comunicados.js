const express = require('express');
const { getPool } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail, HttpError } = require('../lib/http');
const { audit } = require('../lib/audit');
const { sanitizeText } = require('../lib/sanitize');
const { sendPush } = require('../lib/push');
const { sendMail, escapeHtml } = require('../lib/mailer');

// Comunicados del administrador a un cliente o técnico (RF-116 elegir APP PUSH o EMAIL, RF-117 procesar el envío).
const router = express.Router();
const db = () => getPool();
const adminOnly = [auth, requireRole(ROL.ADMIN)];

router.post('/api/admin/comunicados', ...adminOnly, async (req, res) => {
  const idUsuario = Number(req.body?.id_usuario);
  const canal = String(req.body?.canal || '').toUpperCase();
  const asunto = sanitizeText(req.body?.asunto, 80);
  const mensaje = sanitizeText(req.body?.mensaje, 500);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) return fail(res, 400, 'VALIDATION_ERROR', 'Elige a quién enviar el mensaje.', { field: 'id_usuario' });
  if (!['PUSH', 'EMAIL'].includes(canal)) return fail(res, 400, 'VALIDATION_ERROR', 'Elige el medio de entrega: APP PUSH o EMAIL.', { field: 'canal' });
  if (asunto.length < 3) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe un asunto de al menos 3 caracteres.', { field: 'asunto' });
  if (mensaje.length < 5) return fail(res, 400, 'VALIDATION_ERROR', 'Escribe el mensaje (al menos 5 caracteres).', { field: 'mensaje' });

  const u = (await db().query(
    'SELECT id_usuario, nombre, correo, push_token, preferencias, id_rol FROM usuarios WHERE id_usuario = $1 AND anonimizado = false',
    [idUsuario]
  )).rows[0];
  if (!u || u.id_rol === ROL.ADMIN) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado.');

  if (canal === 'PUSH') {
    if (!u.push_token?.startsWith('ExponentPushToken')) {
      return fail(res, 409, 'NO_PUSH_TOKEN', 'Esta persona no tiene la app con notificaciones activadas. Envíale un EMAIL.');
    }
    if (u.preferencias?.notificaciones_push === false) {
      return fail(res, 409, 'PUSH_DISABLED', 'Esta persona desactivó las notificaciones de la app. Envíale un EMAIL.');
    }
    sendPush(u.id_usuario, asunto, mensaje, { tipo: 'COMUNICADO' });
  } else {
    try {
      await sendMail({
        to: u.correo,
        subject: `${asunto} - Click & Serve`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0C1C40">
          <h2 style="margin:0 0 12px">${escapeHtml(asunto)}</h2><p>Hola ${escapeHtml(u.nombre)},</p>
          <p style="white-space:pre-wrap">${escapeHtml(mensaje)}</p>
          <p style="color:#667085;font-size:12px">Mensaje del equipo de Click &amp; Serve.</p></div>`,
      });
    } catch (error) {
      if (error instanceof HttpError) return fail(res, 503, 'MAIL_UNAVAILABLE', 'El correo no está configurado en el servidor: no se pudo enviar el mensaje.');
      throw error;
    }
  }

  const { rows } = await db().query(
    `INSERT INTO comunicados_admin (id_admin, id_usuario, canal, asunto, mensaje) VALUES ($1, $2, $3, $4, $5)
     RETURNING id_comunicado, canal, asunto, mensaje, fecha`,
    [req.user.id_usuario, u.id_usuario, canal, asunto, mensaje]
  );
  audit(req, 'COMUNICADO_ENVIADO', 'usuario', u.id_usuario, { canal, asunto });
  res.status(201).json({ mensaje: canal === 'PUSH' ? 'Notificación enviada a la app.' : 'Correo enviado.', comunicado: rows[0] });
});

// Historial de lo que se le ha enviado a una persona (últimos 20).
router.get('/api/admin/comunicados', ...adminOnly, async (req, res) => {
  const idUsuario = Number(req.query.id_usuario);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) return fail(res, 400, 'VALIDATION_ERROR', 'Indica la persona.', { field: 'id_usuario' });
  const { rows } = await db().query(
    `SELECT c.id_comunicado, c.canal, c.asunto, c.mensaje, c.fecha, CONCAT(a.nombre, ' ', a.apellido) AS enviado_por
     FROM comunicados_admin c JOIN usuarios a ON a.id_usuario = c.id_admin
     WHERE c.id_usuario = $1 ORDER BY c.fecha DESC LIMIT 20`,
    [idUsuario]
  );
  res.json({ comunicados: rows });
});

module.exports = router;
