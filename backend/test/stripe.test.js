const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { resetDb, startServer, createUser, api, login, idem, getPool, closePool } = require('./helpers');

// Stripe se simula interceptando fetch hacia api.stripe.com: ninguna prueba llama a Stripe de verdad.
let server;
const realFetch = global.fetch;
const llamadas = [];
let responder = () => ({ status: 404, body: { error: { message: 'sin simular' } } });

test.before(async () => {
  await resetDb();
  server = await startServer();
  process.env.STRIPE_SECRET_KEY = 'rk_test_simulada';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  global.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://api.stripe.com')) return realFetch(url, opts);
    const path = String(url).replace('https://api.stripe.com/v1', '');
    const params = new URLSearchParams(opts.body || '');
    llamadas.push({ method: opts.method, path, params, headers: opts.headers });
    const { status = 200, body } = responder(opts.method, path, params);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
});
test.after(async () => {
  global.fetch = realFetch;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  await server.close();
  await closePool();
});

async function cliente() {
  const u = await createUser({ rol: 1 });
  return { ...u, token: await login(server.url, u) };
}

const sesionCompleta = (idUsuario, pm = 'pm_visa_1') => ({
  id: 'cs_test_123', mode: 'setup', status: 'complete', customer: 'cus_123',
  metadata: { id_usuario: String(idUsuario), retorno: 'http://localhost:8081/tarjetas' },
  setup_intent: { id: 'seti_1', payment_method: { id: pm, card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 }, billing_details: { name: 'Ana Prueba' } } },
});

test('el proveedor activo es Stripe cuando hay llave', async () => {
  const c = await cliente();
  const r = await api(server.url, 'GET', '/api/pagos/proveedor', { token: c.token });
  assert.equal(r.body.proveedor, 'STRIPE');
});

test('guardar tarjeta: crea el Customer y una sesión de Checkout en modo setup; rechaza retornos ajenos', async () => {
  const c = await cliente();
  responder = (method, path) => {
    if (path === '/customers') return { body: { id: 'cus_nuevo' } };
    if (path === '/checkout/sessions') return { body: { id: 'cs_test_abc', url: 'https://checkout.stripe.com/c/pay/cs_test_abc' } };
    return { status: 404, body: {} };
  };
  const malo = await api(server.url, 'POST', '/api/tarjetas/stripe/sesion', { token: c.token, body: { retorno: 'https://evil.example.com/robar' } });
  assert.equal(malo.status, 400);
  const r = await api(server.url, 'POST', '/api/tarjetas/stripe/sesion', { token: c.token, body: { retorno: 'http://localhost:8081/tarjetas' } });
  assert.equal(r.status, 200);
  assert.match(r.body.url, /checkout\.stripe\.com/);
  const sesion = llamadas.filter((l) => l.path === '/checkout/sessions').pop();
  assert.equal(sesion.params.get('mode'), 'setup');
  assert.equal(sesion.params.get('currency'), 'mxn');
  assert.equal(sesion.params.get('customer'), 'cus_nuevo');
  assert.equal(sesion.params.get('payment_method_types[]'), null, 'métodos de pago dinámicos (no se fija payment_method_types)');
  const u = await getPool().query('SELECT stripe_customer_id FROM usuarios WHERE id_usuario = $1', [c.id]);
  assert.equal(u.rows[0].stripe_customer_id, 'cus_nuevo');
});

test('al volver de Stripe se guarda la tarjeta una sola vez y se regresa a la app', async () => {
  const c = await cliente();
  responder = (method, path) => (path.startsWith('/checkout/sessions/cs_test_123') ? { body: sesionCompleta(c.id) } : { status: 404, body: {} });
  const res = await realFetch(`${server.url}/api/stripe/retorno?session_id=cs_test_123`, { redirect: 'manual' });
  assert.equal(res.status, 303);
  assert.match(res.headers.get('location'), /^http:\/\/localhost:8081\/tarjetas\?tarjeta=ok&session_id=cs_test_123/);
  // La app confirma de nuevo: no se duplica.
  const conf = await api(server.url, 'POST', '/api/tarjetas/stripe/confirmar', { token: c.token, body: { session_id: 'cs_test_123' } });
  assert.equal(conf.status, 200);
  const tarjetas = await api(server.url, 'GET', '/api/metodos-pago', { token: c.token });
  assert.equal(tarjetas.body.metodos.length, 1);
  assert.deepEqual([tarjetas.body.metodos[0].marca, tarjetas.body.metodos[0].ultimos_4, tarjetas.body.metodos[0].expiracion], ['VISA', '4242', '12/30']);
  // Otro cliente no puede confirmar la sesión ajena.
  const otro = await cliente();
  assert.equal((await api(server.url, 'POST', '/api/tarjetas/stripe/confirmar', { token: otro.token, body: { session_id: 'cs_test_123' } })).status, 404);
});

test('webhook: solo acepta eventos con firma válida y guarda la tarjeta del checkout', async () => {
  const c = await cliente();
  responder = (method, path) => (path.startsWith('/checkout/sessions/') ? { body: sesionCompleta(c.id, 'pm_webhook') } : { status: 404, body: {} });
  const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_123', mode: 'setup' } } });
  const sinFirma = await realFetch(`${server.url}/api/stripe/webhook`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=abc' } });
  assert.equal(sinFirma.status, 400);
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', 'whsec_prueba').update(`${t}.${payload}`).digest('hex');
  const ok = await realFetch(`${server.url}/api/stripe/webhook`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${v1}` } });
  assert.equal(ok.status, 200);
  const row = await getPool().query("SELECT proveedor, cliente_externo FROM metodos_pago WHERE token = 'pm_webhook'");
  assert.deepEqual(row.rows[0], { proveedor: 'STRIPE', cliente_externo: 'cus_123' });
});

async function ordenEsperandoPago() {
  const c = await cliente();
  const t = await createUser({ rol: 2, latitud: 17.96, longitud: -102.2, disponible: true });
  const tToken = await login(server.url, t);
  const s = (await api(server.url, 'POST', '/api/solicitudes', {
    token: c.token, headers: idem(),
    body: { categoria: 'PLOMERIA', descripcion: 'Fuga en el lavabo del baño principal.', direccion: 'Calle 8 #3, Centro', latitud: 17.958, longitud: -102.2 },
  })).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: tToken });
  const { rows } = await getPool().query(
    `INSERT INTO metodos_pago (id_usuario, titular, ultimos_4, expiracion, token, marca, predeterminada, proveedor, cliente_externo)
     VALUES ($1, 'Ana', '4242', '12/30', $2, 'VISA', true, 'STRIPE', 'cus_123') RETURNING id_metodo`,
    [c.id, `pm_${crypto.randomUUID().slice(0, 8)}`]
  );
  return { c, t, tToken, id: s.id_solicitud, metodo: rows[0].id_metodo };
}

test('pagar el precio base cobra con un PaymentIntent fuera de sesión y queda en custodia', async () => {
  const { c, id, metodo } = await ordenEsperandoPago();
  responder = (method, path) => (path === '/payment_intents' ? { body: { id: 'pi_base_1', status: 'succeeded' } } : { status: 404, body: {} });
  const r = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(r.status, 200);
  assert.equal(r.body.custodia.modo, 'STRIPE');
  assert.equal(r.body.custodia.referencia, 'pi_base_1');
  const pi = llamadas.filter((l) => l.path === '/payment_intents').pop();
  assert.equal(pi.params.get('amount'), '30000', 'precio sugerido de Plomería en centavos');
  assert.equal(pi.params.get('currency'), 'mxn');
  assert.equal(pi.params.get('off_session'), 'true');
  assert.equal(pi.params.get('confirm'), 'true');
  assert.ok(pi.headers['Idempotency-Key'], 'el cobro lleva llave de idempotencia');
});

test('si el banco rechaza o pide autenticación, no se libera nada y se explica en español', async () => {
  const { c, id, metodo } = await ordenEsperandoPago();
  responder = () => ({ status: 402, body: { error: { type: 'card_error', code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.' } } });
  const r = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(r.status, 402);
  assert.equal(r.body.error, 'La tarjeta no tiene fondos suficientes.');
  responder = () => ({ status: 402, body: { error: { type: 'card_error', code: 'authentication_required', payment_intent: { id: 'pi_x', status: 'requires_payment_method' } } } });
  const r2 = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(r2.status, 402);
  assert.match(r2.body.error, /banco pide confirmar/);
  // Cada intento usa una llave de idempotencia nueva: Stripe guarda 24 h hasta los rechazos, y con la misma llave
  // el cliente no podría volver a intentar con la misma tarjeta.
  const llaves = llamadas.filter((l) => l.path === '/payment_intents').slice(-2).map((l) => l.headers['Idempotency-Key']);
  assert.equal(llaves.length, 2);
  assert.notEqual(llaves[0], llaves[1]);
  const row = await getPool().query('SELECT estado, estado_pago, direccion_liberada FROM solicitudes_servicio WHERE id_solicitud = $1', [id]);
  assert.deepEqual(row.rows[0], { estado: 'ESPERANDO_APROBACION', estado_pago: 'PENDIENTE', direccion_liberada: false });
});

test('al cancelar, la custodia de Stripe se reembolsa a la tarjeta en automático', async () => {
  const { procesarReembolsos } = require('../src/services/stripe');
  const { c, id, metodo } = await ordenEsperandoPago();
  responder = (method, path) => {
    if (path === '/payment_intents') return { body: { id: 'pi_reemb', status: 'succeeded' } };
    if (path.startsWith('/payment_intents/pi_reemb')) return { body: { id: 'pi_reemb', amount_received: 30000, latest_charge: { amount_refunded: 0 } } };
    if (path === '/refunds') return { body: { id: 're_1', status: 'succeeded' } };
    return { status: 404, body: {} };
  };
  await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  const cancel = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: c.token, body: { motivo: 'Ya no' } });
  assert.equal(cancel.status, 200);
  await procesarReembolsos(id);
  const refund = llamadas.filter((l) => l.path === '/refunds').pop();
  assert.equal(refund.params.get('payment_intent'), 'pi_reemb');
  assert.equal(refund.params.get('amount'), '30000');
  const k = await getPool().query('SELECT estado, referencia_reembolso FROM custodias WHERE id_solicitud = $1', [id]);
  assert.deepEqual(k.rows[0], { estado: 'REEMBOLSADO', referencia_reembolso: 're_1' });
});
