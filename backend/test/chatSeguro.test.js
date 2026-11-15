const test = require('node:test');
const assert = require('node:assert/strict');
const { filtrarTexto } = require('../src/lib/chatFilter');
const { resetDb, startServer, createUser, api, login, closePool } = require('./helpers');

// ───────────────────────── Filtro (sin base de datos) ─────────────────────────
const bloquea = (texto, motivo) => {
  const r = filtrarTexto(texto);
  assert.equal(r.bloqueado, true, `debía bloquear: ${texto}`);
  assert.ok(r.texto.includes('[BLOQUEADO]'));
  if (motivo) assert.ok(r.motivos.includes(motivo), `${texto} → ${r.motivos.join(',')}`);
};
const deja = (texto) => {
  const r = filtrarTexto(texto);
  assert.equal(r.bloqueado, false, `no debía bloquear: ${texto} → ${r.texto}`);
  assert.equal(r.texto, texto);
};

test('filtro: teléfonos juntos, con espacios, guiones, lada o en palabras', () => {
  bloquea('mi número es 7531234567', 'TELEFONO');
  bloquea('llámame al 753 123 45 67', 'TELEFONO');
  bloquea('al +52 (753) 123-4567', 'TELEFONO');
  bloquea('siete cinco tres uno dos tres cuatro cinco seis siete', 'TELEFONO');
});

test('filtro: apps de mensajería y redes sociales', () => {
  bloquea('escríbeme por WhatsApp', 'APP_MENSAJERIA');
  bloquea('mándame whats', 'APP_MENSAJERIA');
  bloquea('por Telegram mejor', 'APP_MENSAJERIA');
  bloquea('búscame en el face o en IG', 'APP_MENSAJERIA');
});

test('filtro: pagos directos o por fuera', () => {
  bloquea('págame en efectivo', 'PAGO_FUERA');
  bloquea('hacemos trato directo', 'PAGO_FUERA');
  bloquea('lo vemos por fuera', 'PAGO_FUERA');
  bloquea('cancélame a mí', 'PAGO_FUERA');
});

test('filtro: tarjetas, CLABE y menciones de cuenta bancaria', () => {
  bloquea('4152 3138 1234 5678', 'TARJETA');
  bloquea('012180001234567891', 'CLABE');
  bloquea('te paso mi cuenta', 'DATOS_BANCARIOS');
  bloquea('mi CLABE', 'DATOS_BANCARIOS');
});

test('filtro: enlaces y correos', () => {
  bloquea('wa.me/5217531234567', 'ENLACE');
  bloquea('https://algo.mx/x', 'ENLACE');
  bloquea('www.sitio.com', 'ENLACE');
  bloquea('juan.perez@gmail.com', 'CORREO');
  bloquea('juan arroba gmail punto com', 'CORREO');
});

test('filtro: conversación normal del servicio no se toca', () => {
  deja('Llego a las 10:30, el material cuesta $1500');
  deja('Voy a instalar el contacto, te doy cuenta del avance');
  deja('Tengo dos tres dudas sobre el trabajo');
  deja('El folio es SOL-000123 del 2026-10-31');
  deja('Ya me di cuenta, cancela la cita de mañana');
  deja('La tarjeta de crédito ya está guardada en la app');
});

// ───────────────────────── Rutas ─────────────────────────
let server;
test.before(async () => {
  await resetDb();
  server = await startServer();
});
test.after(async () => { await server.close(); await closePool(); });

async function as(rol, opts = {}) {
  const u = await createUser({ rol, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function conversacion() {
  const cliente = await as(1);
  const tecnico = await as(2);
  const res = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: tecnico.id } });
  return { cliente, tecnico, id: res.body.conversacion.id_conversacion };
}

test('chat seguro: sin aceptar las políticas no se puede escribir', async () => {
  const { cliente, id } = await conversacion();
  const hilo = await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: cliente.token });
  assert.equal(hilo.body.politicas_aceptadas, false);
  const res = await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: cliente.token, body: { mensaje: 'hola' } });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'CHAT_POLICY_REQUIRED');
});

test('chat seguro: la aceptación es por persona y el mensaje se guarda filtrado', async () => {
  const { cliente, tecnico, id } = await conversacion();
  const acepta = await api(server.url, 'POST', `/api/chat-directo/${id}/politicas`, { token: cliente.token });
  assert.equal(acepta.status, 200);
  assert.equal((await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: cliente.token })).body.politicas_aceptadas, true);
  assert.equal((await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: tecnico.token })).body.politicas_aceptadas, false);

  const res = await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: cliente.token, body: { mensaje: 'Mándame whats al 7531234567' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.filtrado.bloqueado, true);
  assert.equal(res.body.mensaje.mensaje, 'Mándame [BLOQUEADO] al [BLOQUEADO]');
  const hilo = await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: tecnico.token });
  assert.equal(hilo.body.mensajes[0].mensaje, 'Mándame [BLOQUEADO] al [BLOQUEADO]');
});
