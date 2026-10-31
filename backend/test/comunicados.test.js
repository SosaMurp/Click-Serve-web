const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');
const { outbox } = require('../src/lib/mailer');

// Comunicados del administrador por APP PUSH o EMAIL (RF-116, RF-117).
let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

async function escenario() {
  const admin = await createUser({ rol: 3 });
  const persona = await createUser({ rol: 2 });
  return { admin, persona, token: await login(server.url, admin) };
}
const enviar = (token, body) => api(server.url, 'POST', '/api/admin/comunicados', { token, body });

test('el correo se envía y queda en el historial de la persona', async () => {
  const { persona, token } = await escenario();
  const antes = outbox.length;
  const res = await enviar(token, { id_usuario: persona.id, canal: 'EMAIL', asunto: 'Actualiza tu documento', mensaje: 'Tu cédula vence pronto, súbela de nuevo.' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(outbox.length, antes + 1);
  assert.equal(outbox.at(-1).to, persona.email);
  const hist = await api(server.url, 'GET', `/api/admin/comunicados?id_usuario=${persona.id}`, { token });
  assert.equal(hist.body.comunicados.length, 1);
  assert.equal(hist.body.comunicados[0].canal, 'EMAIL');
});

test('el push exige la app con notificaciones activas', async () => {
  const { persona, token } = await escenario();
  const body = { id_usuario: persona.id, canal: 'PUSH', asunto: 'Aviso', mensaje: 'Tienes un servicio nuevo cerca.' };
  const sinToken = await enviar(token, body);
  assert.equal(sinToken.status, 409);
  assert.equal(sinToken.body.code, 'NO_PUSH_TOKEN');

  await getPool().query("UPDATE usuarios SET push_token = 'ExponentPushToken[abc]' WHERE id_usuario = $1", [persona.id]);
  assert.equal((await enviar(token, body)).status, 201);

  await getPool().query(`UPDATE usuarios SET preferencias = '{"notificaciones_push": false}' WHERE id_usuario = $1`, [persona.id]);
  assert.equal((await enviar(token, body)).body.code, 'PUSH_DISABLED');
});

test('valida los datos y es solo para administradores', async () => {
  const { persona, token } = await escenario();
  const ok = { id_usuario: persona.id, canal: 'EMAIL', asunto: 'Hola', mensaje: 'Mensaje de prueba' };
  assert.equal((await enviar(token, { ...ok, canal: 'SMS' })).status, 400);
  assert.equal((await enviar(token, { ...ok, asunto: 'a' })).status, 400);
  assert.equal((await enviar(token, { ...ok, mensaje: '' })).status, 400);
  assert.equal((await enviar(token, { ...ok, id_usuario: 999999 })).status, 404);
  const cliente = await createUser({ rol: 1 });
  assert.equal((await enviar(await login(server.url, cliente), ok)).status, 403);
  assert.equal((await api(server.url, 'POST', '/api/admin/comunicados', { body: ok })).status, 401);
});

test('un administrador no es destinatario válido', async () => {
  const { admin, token } = await escenario();
  const res = await enviar(token, { id_usuario: admin.id, canal: 'EMAIL', asunto: 'Hola', mensaje: 'Mensaje de prueba' });
  assert.equal(res.status, 404);
});
