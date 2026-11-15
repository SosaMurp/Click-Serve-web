const express = require('express');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail } = require('../lib/http');
const { audit } = require('../lib/audit');
const { isDevelopment } = require('../lib/env');
const { getPool } = require('../db/pool');
const stripe = require('../services/stripe');
const { proveedorPagos } = require('../services/payments');

// Stripe: guardar tarjetas con Checkout (modo setup) y webhook firmado. Los cobros y reembolsos viven en
// services/payments.js y services/stripe.js.
const router = express.Router();
const MAX_TARJETAS = 5;

// A dónde puede volver el cliente después del formulario de Stripe: la app (click-serve://, exp:// de Expo Go)
// o la web de la app. En desarrollo también localhost y la red local; en producción, solo APP_WEB_ORIGINS.
function retornoValido(url) {
  if (!url) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (['click-serve:', 'exp:', 'exps:'].includes(u.protocol)) return true;
  if (!['http:', 'https:'].includes(u.protocol)) return false;
  const permitidos = String(process.env.APP_WEB_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (permitidos.includes(u.origin)) return true;
  if (!isDevelopment()) return false;
  return /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(u.hostname);
}

// Agrega el resultado a la dirección de retorno (a mano: en exp:// y click-serve:// URL no siempre entiende la ruta).
function conEstado(url, params) {
  const [sinHash] = url.split('#');
  const qs = new URLSearchParams(params).toString();
  return `${sinHash}${sinHash.includes('?') ? '&' : '?'}${qs}`;
}

const baseUrl = (req) => process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

router.get('/api/pagos/proveedor', auth, (_req, res) => {
  res.json({ proveedor: proveedorPagos() });
});

router.post('/api/tarjetas/stripe/sesion', auth, requireRole(ROL.CLIENTE), async (req, res) => {
  if (!stripe.enabled()) return fail(res, 503, 'PAYMENTS_UNAVAILABLE', 'Stripe no está configurado en el servidor.');
  const { rows: [n] } = await getPool().query('SELECT COUNT(*)::int AS n FROM metodos_pago WHERE id_usuario = $1 AND token IS NOT NULL', [req.user.id_usuario]);
  if (n.n >= MAX_TARJETAS) return fail(res, 409, 'CARD_LIMIT', 'Puedes guardar hasta 5 tarjetas.');
  const retorno = String(req.body?.retorno || '');
  if (retorno && !retornoValido(retorno)) return fail(res, 400, 'VALIDATION_ERROR', 'Dirección de retorno no permitida.', { field: 'retorno' });
  const sesion = await stripe.crearSesionTarjeta(req.user, { baseUrl: baseUrl(req), retorno });
  audit(req, 'STRIPE_SESION_TARJETA', 'usuario', req.user.id_usuario, { session: sesion.id });
  res.json(sesion);
});

// Stripe regresa aquí al terminar el formulario: se guarda la tarjeta y se vuelve a la app.
router.get('/api/stripe/retorno', async (req, res) => {
  const sessionId = String(req.query.session_id || '');
  let estado = req.query.cancelado ? 'cancelada' : 'error';
  let retorno = '';
  if (stripe.enabled() && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const session = await stripe.obtenerSesion(sessionId);
      retorno = session.metadata?.retorno || '';
      if (!req.query.cancelado) estado = (await stripe.guardarTarjetaDeSesion(session)) ? 'ok' : 'error';
    } catch (error) {
      console.error('Retorno de Stripe:', error.message);
    }
  }
  if (retorno && retornoValido(retorno)) return res.redirect(303, conEstado(retorno, { tarjeta: estado, session_id: sessionId }));
  const texto = estado === 'ok' ? 'Tu tarjeta quedó guardada. Ya puedes volver a Click &amp; Serve.'
    : estado === 'cancelada' ? 'No se guardó ninguna tarjeta. Puedes volver a Click &amp; Serve.'
      : 'No pudimos guardar la tarjeta. Vuelve a Click &amp; Serve e inténtalo de nuevo.';
  res.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Click &amp; Serve</title><body style="font-family:system-ui;padding:32px;color:#0C1C40"><h1 style="font-size:22px">Click &amp; Serve</h1><p style="font-size:18px">${texto}</p></body></html>`);
});

// La app confirma al volver (por si el navegador no siguió la redirección). Solo guarda tarjetas del propio usuario.
router.post('/api/tarjetas/stripe/confirmar', auth, requireRole(ROL.CLIENTE), async (req, res) => {
  const sessionId = String(req.body?.session_id || '');
  if (!stripe.enabled() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return fail(res, 400, 'VALIDATION_ERROR', 'Sesión de Stripe no válida.');
  const session = await stripe.obtenerSesion(sessionId);
  if (Number(session.metadata?.id_usuario) !== req.user.id_usuario) return fail(res, 404, 'NOT_FOUND', 'Sesión no encontrada.');
  const tarjeta = await stripe.guardarTarjetaDeSesion(session);
  if (!tarjeta) return fail(res, 409, 'SETUP_INCOMPLETE', 'Stripe aún no confirma la tarjeta. Intenta de nuevo en un momento.');
  if (tarjeta.nueva) audit(req, 'TARJETA_AGREGADA', 'metodo_pago', tarjeta.id_metodo, { proveedor: 'STRIPE', ultimos_4: tarjeta.ultimos_4 });
  res.json({ mensaje: `Tarjeta •••• ${tarjeta.ultimos_4} guardada.`, id_metodo: tarjeta.id_metodo });
});

// Webhook (se monta antes de express.json en app.js para recibir el cuerpo crudo y verificar la firma).
async function webhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!stripe.verificarFirma(raw, req.get('stripe-signature'))) return res.status(400).json({ error: 'Firma de Stripe no válida.' });
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Evento no válido.' }); }
  try {
    if (event.type === 'checkout.session.completed' && event.data?.object?.mode === 'setup') {
      // El evento no trae el PaymentMethod expandido: se consulta la sesión completa.
      await stripe.guardarTarjetaDeSesion(await stripe.obtenerSesion(event.data.object.id));
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      console.warn(`Stripe: cobro fallido ${pi.id} (${pi.metadata?.folio || 'sin folio'}): ${pi.last_payment_error?.message || ''}`);
    } else if (event.type === 'charge.dispute.created') {
      console.error(`Stripe: contracargo abierto ${event.data.object.id} por ${event.data.object.amount / 100} MXN. Revísalo en el Dashboard.`);
    }
  } catch (error) {
    // 500 para que Stripe reintente el evento más tarde.
    console.error(`Webhook de Stripe ${event.type}:`, error.message);
    return res.status(500).json({ error: 'No se pudo procesar el evento.' });
  }
  res.json({ recibido: true });
}

module.exports = router;
module.exports.webhook = webhook;
module.exports.retornoValido = retornoValido;
