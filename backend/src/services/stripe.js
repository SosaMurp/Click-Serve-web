// Stripe (https://docs.stripe.com/api): pasarela de pagos de Click & Serve.
// - Guardar tarjeta: Checkout Session en modo "setup" (Stripe aloja el formulario; el número nunca pasa por
//   Click & Serve). El SetupIntent deja un PaymentMethod (pm_...) ligado al Customer (cus_...) del cliente.
// - Cobrar (precio base, adicional, conceptos extra): PaymentIntent fuera de sesión (off_session + confirm).
// - Reembolsar la custodia: Refunds sobre los PaymentIntents que la pagaron.
// - Webhook firmado (Stripe-Signature) para guardar la tarjeta aunque el cliente no regrese a la app.
// Se usa la API REST con fetch (sin SDK) para mantener el mismo patrón que el resto de las pasarelas.
// Llaves en backend/.env: STRIPE_SECRET_KEY (recomendado: llave restringida rk_...) y STRIPE_WEBHOOK_SECRET.
const crypto = require('crypto');
const { getPool } = require('../db/pool');

const API = 'https://api.stripe.com/v1';
const API_VERSION = process.env.STRIPE_API_VERSION || '2026-10-28.endive';
const MARCAS = { visa: 'VISA', mastercard: 'MASTERCARD', amex: 'AMEX', carnet: 'CARNET' };

const enabled = () => !!process.env.STRIPE_SECRET_KEY;
const db = () => getPool();

class StripeUncertainError extends Error {}

// Codifica un objeto como application/x-www-form-urlencoded con la notación de corchetes de Stripe.
function encode(params, prefix, out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encode(item, `${key}[${i}]`, out) : out.append(`${key}[]`, String(item))));
    else if (typeof v === 'object') encode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function request(method, path, params, { idempotencyKey, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const query = method === 'GET' && params ? `?${encode(params).toString()}` : '';
  try {
    const res = await fetch(`${API}${path}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Stripe-Version': API_VERSION,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: method === 'GET' ? undefined : encode(params).toString(),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    // La petición pudo llegar a Stripe antes del corte: no se sabe si se ejecutó.
    throw new StripeUncertainError(error.name === 'AbortError' ? 'Stripe no respondió a tiempo.' : 'No se pudo contactar a Stripe.');
  } finally {
    clearTimeout(timer);
  }
}

// ───────────── Clientes ─────────────
async function asegurarCliente(user, q = db()) {
  const { rows: [u] } = await q.query('SELECT id_usuario, nombre, apellido, correo, stripe_customer_id FROM usuarios WHERE id_usuario = $1', [user.id_usuario]);
  if (u.stripe_customer_id) return u.stripe_customer_id;
  const r = await request('POST', '/customers', {
    email: u.correo,
    name: `${u.nombre} ${u.apellido || ''}`.trim(),
    metadata: { id_usuario: u.id_usuario },
  }, { idempotencyKey: `cs-customer-${u.id_usuario}` });
  if (!r.ok || !r.body.id) throw new Error(r.body?.error?.message || 'No se pudo crear el cliente en Stripe.');
  await q.query('UPDATE usuarios SET stripe_customer_id = $2 WHERE id_usuario = $1 AND stripe_customer_id IS NULL', [u.id_usuario, r.body.id]);
  const again = await q.query('SELECT stripe_customer_id FROM usuarios WHERE id_usuario = $1', [u.id_usuario]);
  return again.rows[0].stripe_customer_id;
}

// ───────────── Guardar tarjeta (Checkout en modo setup) ─────────────
async function crearSesionTarjeta(user, { baseUrl, retorno }) {
  const customer = await asegurarCliente(user);
  const r = await request('POST', '/checkout/sessions', {
    mode: 'setup',
    currency: 'mxn',
    customer,
    locale: 'es-419',
    success_url: `${baseUrl}/api/stripe/retorno?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/api/stripe/retorno?cancelado=1&session_id={CHECKOUT_SESSION_ID}`,
    // El retorno se guarda en Stripe (no viaja en la URL) para no abrir redirecciones arbitrarias.
    metadata: { id_usuario: user.id_usuario, retorno: retorno || '' },
    setup_intent_data: { metadata: { id_usuario: user.id_usuario } },
  });
  if (!r.ok || !r.body.url) throw new Error(r.body?.error?.message || 'No se pudo abrir el formulario de Stripe.');
  return { id: r.body.id, url: r.body.url };
}

async function obtenerSesion(sessionId) {
  const r = await request('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`, { expand: ['setup_intent.payment_method'] });
  if (!r.ok) throw new Error(r.body?.error?.message || 'No se encontró la sesión de Stripe.');
  return r.body;
}

// Guarda en metodos_pago la tarjeta de una sesión completada. Idempotente (retorno y webhook pueden llegar ambos).
async function guardarTarjetaDeSesion(session, q = db()) {
  const idUsuario = Number(session?.metadata?.id_usuario);
  if (session?.mode !== 'setup' || session?.status !== 'complete' || !idUsuario) return null;
  const pm = session.setup_intent?.payment_method;
  if (!pm?.id || !pm.card) return null;
  const card = pm.card;
  const marca = MARCAS[String(card.brand).toLowerCase()] || String(card.brand || 'VISA').toUpperCase();
  const expiracion = `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`;
  const titular = (pm.billing_details?.name || '').slice(0, 100) || null;
  const { rows: [existe] } = await q.query('SELECT id_metodo FROM metodos_pago WHERE id_usuario = $1 AND token = $2', [idUsuario, pm.id]);
  if (existe) return { id_metodo: existe.id_metodo, ultimos_4: card.last4, nueva: false };
  const { rows: [n] } = await q.query('SELECT COUNT(*)::int AS n FROM metodos_pago WHERE id_usuario = $1 AND token IS NOT NULL', [idUsuario]);
  const { rows: [nueva] } = await q.query(
    `INSERT INTO metodos_pago (id_usuario, titular, ultimos_4, expiracion, token, marca, predeterminada, proveedor, cliente_externo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'STRIPE', $8)
     ON CONFLICT (id_usuario, token) WHERE proveedor = 'STRIPE' DO NOTHING
     RETURNING id_metodo`,
    [idUsuario, titular, card.last4, expiracion, pm.id, marca, n.n === 0, session.customer]
  );
  return nueva ? { id_metodo: nueva.id_metodo, ultimos_4: card.last4, nueva: true } : null;
}

async function desligarTarjeta(paymentMethodId) {
  if (!enabled() || !String(paymentMethodId).startsWith('pm_')) return;
  await request('POST', `/payment_methods/${encodeURIComponent(paymentMethodId)}/detach`, {}).catch(() => {});
}

// ───────────── Cobros ─────────────
const MOTIVOS = {
  insufficient_funds: 'La tarjeta no tiene fondos suficientes.',
  expired_card: 'La tarjeta está vencida.',
  incorrect_cvc: 'El código de seguridad no es correcto.',
  lost_card: 'La tarjeta fue rechazada por el banco emisor.',
  stolen_card: 'La tarjeta fue rechazada por el banco emisor.',
};

// Cobro fuera de sesión a una tarjeta guardada. Devuelve el mismo formato que chargeCard.
async function cobrar({ paymentMethod, amount, description, idempotencyKey, metadata }) {
  const { rows: [m] } = await db().query('SELECT cliente_externo FROM metodos_pago WHERE token = $1 LIMIT 1', [paymentMethod]);
  if (!m?.cliente_externo) return { ok: false, modo: 'STRIPE', motivo: 'Esta tarjeta ya no es válida. Agrégala de nuevo.' };
  let r;
  try {
    r = await request('POST', '/payment_intents', {
      amount: Math.round(Number(amount) * 100),
      currency: 'mxn',
      customer: m.cliente_externo,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      description,
      metadata,
    }, { idempotencyKey });
  } catch (error) {
    return { ok: false, modo: 'STRIPE', unavailable: true, uncertain: true, motivo: error.message };
  }
  if (r.status >= 500) return { ok: false, modo: 'STRIPE', unavailable: true, uncertain: true, motivo: 'Stripe no confirmó el cobro.' };
  const pi = r.ok ? r.body : r.body?.error?.payment_intent;
  if (r.ok && pi?.status === 'succeeded') return { ok: true, modo: 'STRIPE', referencia: pi.id };
  if (r.ok && pi?.status === 'processing') return { ok: false, modo: 'STRIPE', unavailable: true, uncertain: true, motivo: 'El banco sigue procesando el cobro.' };
  const err = r.body?.error || {};
  if (err.code === 'authentication_required' || pi?.status === 'requires_action') {
    return { ok: false, modo: 'STRIPE', motivo: 'Tu banco pide confirmar este pago y no se pudo hacer desde aquí. Usa otra tarjeta o agrega esta de nuevo.' };
  }
  if (r.status === 401 || r.status === 403) {
    console.error('Stripe rechazó la llave de API:', err.message);
    return { ok: false, modo: 'STRIPE', unavailable: true, motivo: 'Los pagos no están disponibles en este momento. Intenta más tarde.' };
  }
  return { ok: false, modo: 'STRIPE', motivo: MOTIVOS[err.decline_code] || MOTIVOS[err.code] || 'La tarjeta fue rechazada por el banco emisor.' };
}

// ───────────── Reembolsos de custodia ─────────────
// La custodia puede venir de varios PaymentIntents (precio base + adicional): se devuelve el monto pendiente
// repartido entre ellos, empezando por el más reciente.
async function reembolsarCustodia(custodia) {
  let pendiente = Math.round(Number(custodia.monto) * 100);
  const intents = String(custodia.referencia || '').split('+').filter((x) => x.startsWith('pi_')).reverse();
  const refs = [];
  for (const pi of intents) {
    if (pendiente <= 0) break;
    const det = await request('GET', `/payment_intents/${pi}`, { expand: ['latest_charge'] });
    if (!det.ok) throw new Error(det.body?.error?.message || `No se encontró el cobro ${pi}.`);
    const disponible = Number(det.body.amount_received || 0) - Number(det.body.latest_charge?.amount_refunded || 0);
    const monto = Math.min(pendiente, Math.max(0, disponible));
    if (monto <= 0) continue;
    const r = await request('POST', '/refunds', { payment_intent: pi, amount: monto, metadata: { id_custodia: custodia.id_custodia } }, {
      idempotencyKey: `cs-refund-${custodia.id_custodia}-${pi}-${monto}`,
    });
    if (!r.ok) throw new Error(r.body?.error?.message || 'Stripe no aceptó el reembolso.');
    refs.push(r.body.id);
    pendiente -= monto;
  }
  if (pendiente > 0) throw new Error('No hay cobros suficientes en Stripe para reembolsar esta custodia.');
  return refs.join('+');
}

// Barrido: las custodias de Stripe pendientes de reembolso se devuelven a la tarjeta automáticamente.
async function procesarReembolsos(idSolicitud = null) {
  if (!enabled()) return 0;
  const { rows } = await db().query(
    `SELECT id_custodia, id_solicitud, id_cliente, monto, referencia FROM custodias
     WHERE estado = 'REEMBOLSO_PENDIENTE' AND modo = 'STRIPE' AND ($1::bigint IS NULL OR id_solicitud = $1)
     ORDER BY fecha_cierre NULLS FIRST LIMIT 20`,
    [idSolicitud]
  );
  let hechos = 0;
  for (const k of rows) {
    try {
      const referencia = await reembolsarCustodia(k);
      await db().query(
        "UPDATE custodias SET estado = 'REEMBOLSADO', referencia_reembolso = $2, fecha_cierre = NOW() WHERE id_custodia = $1 AND estado = 'REEMBOLSO_PENDIENTE'",
        [k.id_custodia, referencia.slice(0, 80)]
      );
      await db().query(
        `UPDATE solicitudes_servicio SET estado_pago = CASE WHEN estado = 'CANCELADA' THEN 'NO_APLICA' ELSE 'PENDIENTE' END
         WHERE id_solicitud = $1 AND estado_pago = 'REEMBOLSO_PENDIENTE'
           AND NOT EXISTS (SELECT 1 FROM custodias WHERE id_solicitud = $1 AND estado = 'REEMBOLSO_PENDIENTE')`,
        [k.id_solicitud]
      );
      require('../lib/realtime').emitToUser(k.id_cliente, 'solicitud.actualizada', {
        id_solicitud: Number(k.id_solicitud),
        aviso: `Te devolvimos $${Number(k.monto).toFixed(2)} a tu tarjeta. Según tu banco, se refleja en 5 a 10 días hábiles.`,
      });
      hechos += 1;
    } catch (error) {
      console.error(`Reembolso Stripe de la custodia ${k.id_custodia}:`, error.message);
    }
  }
  return hechos;
}

// ───────────── Webhook ─────────────
// Verifica Stripe-Signature (t=...,v1=...): HMAC-SHA256 de "t.payload" con el secreto del webhook.
function verificarFirma(rawBody, header, secret = process.env.STRIPE_WEBHOOK_SECRET, toleranciaSeg = 300) {
  if (!secret || !header || !rawBody) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const firmas = String(header).split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !firmas.length || Math.abs(Date.now() / 1000 - t) > toleranciaSeg) return false;
  const esperado = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return firmas.some((f) => f.length === esperado.length && crypto.timingSafeEqual(Buffer.from(f), Buffer.from(esperado)));
}

module.exports = {
  enabled, API_VERSION, encode, request, asegurarCliente, crearSesionTarjeta, obtenerSesion, guardarTarjetaDeSesion,
  desligarTarjeta, cobrar, reembolsarCustodia, procesarReembolsos, verificarFirma, StripeUncertainError,
};
