// Prueba de punta a punta con Stripe REAL en modo de prueba, contra el backend que está corriendo.
// Uso (con el backend arriba en http://localhost:3000):  node scripts/stripe-e2e.js
// Usa las cuentas de prueba (cliente.prueba / tecnico.prueba) y las tarjetas de prueba publicadas por Stripe
// (pm_card_visa, pm_card_chargeCustomerFail). No mueve dinero real: solo corre con llaves rk_test_/sk_test_.
//
// Escenarios:
//  A. Flujo completo: precio base en custodia → en camino → adicional (paga la diferencia) → evidencia →
//     terminar → confirmar. Revisa en Stripe que existan los dos PaymentIntents cobrados.
//  B. Cancelar con el precio base pagado y el técnico sin salir → reembolso automático en Stripe.
//  C. Tarjeta que el banco rechaza → 402 en español, la orden sigue esperando el pago.
require('dotenv').config({ quiet: true });
const { getPool, closePool } = require('../src/db/pool');
const { isDevelopment } = require('../src/lib/env');
const stripe = require('../src/services/stripe');

const API = process.env.E2E_API_URL || 'http://localhost:3000';
const CLIENTE = { email: 'cliente.prueba@clickserve.test', password: 'ClienteTest#2026' };
const TECNICO = { email: 'tecnico.prueba@clickserve.test', password: 'TecnicoTest#2026' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const COORDS = { latitud: 17.958, longitud: -102.2 };

let fallas = 0;
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? '  ✔' : '  ✖'} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) fallas += 1;
  return cond;
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const idem = () => ({ 'Idempotency-Key': require('crypto').randomUUID() });

async function api(method, path, { token, body, headers = {}, form } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (form) init.body = form;
  else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, body: data };
}

async function entrar(cuenta) {
  const r = await api('POST', '/api/login', { body: cuenta });
  if (r.status !== 200 || !r.body.token) throw new Error(`No se pudo entrar como ${cuenta.email}: ${r.status} ${r.body.error || ''}`);
  return { token: r.body.token, usuario: r.body.usuario };
}

// Guarda en la cuenta del cliente una tarjeta de prueba de Stripe (mismo resultado que el formulario de Checkout).
async function tarjetaStripe(usuario, pmPrueba) {
  const customer = await stripe.asegurarCliente(usuario);
  const si = await stripe.request('POST', '/setup_intents', {
    customer, payment_method: pmPrueba, confirm: true, usage: 'off_session',
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata: { id_usuario: usuario.id_usuario, prueba: 'e2e' },
  });
  if (!si.ok || si.body.status !== 'succeeded') throw new Error(`SetupIntent con ${pmPrueba}: ${si.body?.error?.message || si.body.status}`);
  const pm = await stripe.request('GET', `/payment_methods/${si.body.payment_method}`, null);
  const card = pm.body.card || {};
  const { rows: [m] } = await getPool().query(
    `INSERT INTO metodos_pago (id_usuario, titular, ultimos_4, expiracion, token, marca, predeterminada, proveedor, cliente_externo)
     VALUES ($1, 'Prueba E2E', $2, $3, $4, $5, false, 'STRIPE', $6) RETURNING id_metodo`,
    [usuario.id_usuario, card.last4 || '0000', `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`,
      si.body.payment_method, String(card.brand || 'visa').toUpperCase(), customer]
  );
  return { id_metodo: m.id_metodo, pm: si.body.payment_method, last4: card.last4 };
}

async function nuevaOrdenAceptada(c, t, descripcion) {
  const s = await api('POST', '/api/solicitudes', {
    token: c.token, headers: idem(),
    body: { categoria: 'PLOMERIA', descripcion, direccion: 'Calle 8 #3, Centro, Lázaro Cárdenas', ...COORDS },
  });
  if (s.status !== 201) throw new Error(`Crear solicitud: ${s.status} ${s.body.error || ''}`);
  const id = s.body.solicitud.id_solicitud;
  const a = await api('POST', `/api/solicitudes/${id}/aceptar`, { token: t.token });
  if (a.status !== 200) throw new Error(`Aceptar ${s.body.folio}: ${a.status} ${a.body.error || ''}`);
  return { id, folio: s.body.folio, precio: a.body.solicitud.precio_base };
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!isDevelopment()) throw new Error('Este script solo corre con NODE_ENV=development o test.');
  if (!/^(rk|sk)_test_/.test(key)) throw new Error('STRIPE_SECRET_KEY debe ser una llave de PRUEBA (rk_test_ o sk_test_).');
  const salud = await api('GET', '/api/salud').catch(() => null);
  if (!salud || salud.status !== 200) throw new Error(`El backend no responde en ${API}. Arráncalo con npm start.`);

  console.log('Entrando con las cuentas de prueba…');
  const c = await entrar(CLIENTE);
  const t = await entrar(TECNICO);
  await api('PUT', '/api/usuarios/ubicacion', { token: t.token, body: COORDS });

  console.log('Guardando tarjetas de prueba en Stripe…');
  const visa = await tarjetaStripe(c.usuario, 'pm_card_visa');
  ok(!!visa.pm, `Tarjeta Visa •••• ${visa.last4} guardada en Stripe (Customer + Setup Intent)`);
  const rechazada = await tarjetaStripe(c.usuario, 'pm_card_chargeCustomerFail');
  ok(!!rechazada.pm, `Tarjeta que el banco rechazará •••• ${rechazada.last4} guardada`);

  // ───── A. Flujo completo ─────
  console.log('\nA. Flujo completo con adicional');
  const A = await nuevaOrdenAceptada(c, t, 'Fuga en el lavabo del baño principal (prueba E2E A).');
  ok(Number(A.precio) > 0, `${A.folio}: el técnico aceptó y la orden espera el precio base`, `$${A.precio}`);
  const chatAntes = await api('GET', `/api/solicitudes/${A.id}/chat`, { token: c.token });
  ok(chatAntes.body.bloqueado === true, 'Antes de pagar, el chat está bloqueado');
  const base = await api('POST', `/api/solicitudes/${A.id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: visa.id_metodo } });
  ok(base.status === 200 && base.body.custodia?.modo === 'STRIPE', 'Precio base cobrado con Stripe y retenido en custodia', base.body.custodia?.referencia || base.body.error);
  const chatDespues = await api('GET', `/api/solicitudes/${A.id}/chat`, { token: c.token });
  ok(!chatDespues.body.bloqueado, 'Después de pagar, el chat se abre');
  for (const estado of ['EN_CAMINO', 'EN_SITIO']) {
    const r = await api('PATCH', `/api/solicitudes/${A.id}/estado`, { token: t.token, body: { estado } });
    ok(r.status === 200, `Técnico: ${estado}`);
  }
  const adicional = await api('POST', `/api/solicitudes/${A.id}/cotizar`, {
    token: t.token,
    body: { conceptos: [
      { tipo: 'MANO_OBRA', descripcion: 'Precio base · Plomería', monto: Number(A.precio).toFixed(2) },
      { tipo: 'MATERIAL', descripcion: 'Llave mezcladora y manguera', monto: '150.00' },
    ] },
  });
  ok(adicional.status === 200, 'Técnico cotiza un adicional de $150.00');
  const dif = await api('POST', `/api/solicitudes/${A.id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: visa.id_metodo } });
  ok(dif.status === 200 && dif.body.cobrado === '150.00', 'Cliente paga solo la diferencia ($150.00) con Stripe', dif.body.custodia?.referencia || dif.body.error);
  ok(dif.body.solicitud?.estado === 'EN_PROCESO', 'El trabajo inicia');
  const form = new FormData();
  form.append('fotos', new Blob([PNG], { type: 'image/png' }), 'despues.png');
  form.append('tipo', 'DESPUES');
  ok((await api('POST', `/api/solicitudes/${A.id}/evidencias`, { token: t.token, form })).status === 201, 'Técnico sube la evidencia');
  ok((await api('POST', `/api/solicitudes/${A.id}/finalizar`, { token: t.token, headers: idem() })).status === 200, 'Técnico termina el trabajo');
  const conf = await api('POST', `/api/solicitudes/${A.id}/confirmar`, { token: c.token, headers: idem(), body: { id_metodo: visa.id_metodo, calificacion: 5 } });
  ok(conf.status === 200 && conf.body.solicitud?.estado === 'FINALIZADA', 'Cliente confirma: se libera la custodia y se paga al técnico', conf.body.desglose ? `neto técnico $${conf.body.desglose.neto_tecnico}, comisión $${conf.body.desglose.comision}` : conf.body.error);
  const refs = String(dif.body.custodia?.referencia || '').split('+');
  for (const pi of refs) {
    const r = await stripe.request('GET', `/payment_intents/${pi}`, null);
    ok(r.ok && r.body.status === 'succeeded', `En Stripe: ${pi} cobrado`, r.ok ? `$${(r.body.amount_received / 100).toFixed(2)} MXN` : r.body?.error?.message);
  }

  // ───── B. Cancelación con reembolso ─────
  console.log('\nB. Cancelación con reembolso automático');
  const B = await nuevaOrdenAceptada(c, t, 'Gotea la llave del fregadero (prueba E2E B).');
  const pagoB = await api('POST', `/api/solicitudes/${B.id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: visa.id_metodo } });
  ok(pagoB.status === 200, `${B.folio}: precio base cobrado`, pagoB.body.custodia?.referencia);
  const cancel = await api('POST', `/api/solicitudes/${B.id}/cancelar`, { token: c.token, body: { motivo: 'Prueba de reembolso' } });
  ok(cancel.status === 200, 'Cliente cancela antes de que el técnico salga', cancel.body.mensaje);
  let k;
  for (let i = 0; i < 10; i += 1) {
    await espera(1500);
    k = (await getPool().query('SELECT estado, referencia_reembolso FROM custodias WHERE id_solicitud = $1', [B.id])).rows[0];
    if (k?.estado === 'REEMBOLSADO') break;
  }
  ok(k?.estado === 'REEMBOLSADO', 'La custodia se reembolsó sola en Stripe', k?.referencia_reembolso || k?.estado);
  if (k?.referencia_reembolso) {
    const re = await stripe.request('GET', `/refunds/${k.referencia_reembolso.split('+')[0]}`, null);
    ok(re.ok && ['succeeded', 'pending'].includes(re.body.status), `En Stripe: reembolso ${re.body.id}`, re.ok ? `${re.body.status}, $${(re.body.amount / 100).toFixed(2)} MXN` : re.body?.error?.message);
  }

  // ───── C. Rechazo del banco ─────
  console.log('\nC. Tarjeta rechazada por el banco');
  const C = await nuevaOrdenAceptada(c, t, 'No sale agua caliente en la regadera (prueba E2E C).');
  const malo = await api('POST', `/api/solicitudes/${C.id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: rechazada.id_metodo } });
  ok(malo.status === 402, `${C.folio}: el cobro se rechaza con 402`, malo.body.error);
  const det = await api('GET', `/api/solicitudes/${C.id}`, { token: c.token });
  ok(det.body.solicitud?.estado === 'ESPERANDO_APROBACION' && !det.body.solicitud?.direccion_liberada, 'La orden sigue esperando el pago y la dirección sigue oculta');
  await api('POST', `/api/solicitudes/${C.id}/cancelar`, { token: c.token, body: { motivo: 'Fin de la prueba' } });

  // Limpieza: las tarjetas que creó la prueba no se quedan en la cuenta del cliente de prueba.
  for (const t of [visa, rechazada]) {
    await getPool().query('DELETE FROM metodos_pago WHERE id_metodo = $1', [t.id_metodo]);
    await stripe.desligarTarjeta(t.pm);
  }

  console.log(`\n${fallas ? `✖ ${fallas} verificación(es) fallaron.` : '✔ Todo el flujo funcionó con Stripe.'}`);
  console.log('Revisa los cobros en https://dashboard.stripe.com/test/payments');
  process.exitCode = fallas ? 1 : 0;
}

main()
  .catch((error) => { console.error(`\n✖ ${error.message}`); process.exitCode = 1; })
  .finally(() => closePool());
