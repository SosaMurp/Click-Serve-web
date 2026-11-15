// RNF-04 (cierre por inactividad), RNF-05 (Argon2id) y RNF-26 (enlaces firmados de 5 minutos).
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');
const { hashPassword, verifyPassword, needsRehash } = require('../src/lib/passwords');
const { signSession } = require('../src/lib/tokens');
const { signFileUrl } = require('../src/lib/files');

let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

const hashDe = async (id) => (await getPool().query('SELECT contrasena FROM usuarios WHERE id_usuario = $1', [id])).rows[0].contrasena;
const sesionDe = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sessionId;
const envejecer = (sessionId, minutos) => getPool().query(
  `UPDATE sesiones_activas SET ultima_actividad = NOW() - make_interval(mins => $2) WHERE id_sesion = $1`, [sessionId, minutos]
);

// ───── RNF-05 ─────
test('las contraseñas nuevas se guardan con Argon2id y se verifican', async () => {
  const hash = await hashPassword('Segura#2026');
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword('Segura#2026', hash), true);
  assert.equal(await verifyPassword('otra', hash), false);
  assert.equal(needsRehash(hash), false);
});

test('una contraseña bcrypt sigue sirviendo y se re-guarda con Argon2id al iniciar sesión', async () => {
  const u = await createUser({ rol: 1 }); // los usuarios de prueba nacen con bcrypt
  assert.match(await hashDe(u.id), /^\$2[aby]\$/);
  assert.equal(await verifyPassword(u.password, await bcrypt.hash(u.password, 4)), true);
  await login(server.url, u);
  assert.match(await hashDe(u.id), /^\$argon2id\$/, 'tras el login queda en Argon2id');
  // Y con el hash nuevo se puede volver a entrar; la contraseña equivocada sigue fallando.
  await login(server.url, u);
  const mala = await api(server.url, 'POST', '/api/login', { body: { email: u.email, password: 'NoEsLaClave#1' } });
  assert.equal(mala.status, 401);
});

test('cambiar la contraseña la guarda con Argon2id', async () => {
  const u = await createUser({ rol: 1 });
  const token = await login(server.url, u);
  const r = await api(server.url, 'POST', '/api/update-password', { token, body: { currentPassword: u.password, newPassword: 'NuevaClave#2026' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(await hashDe(u.id), /^\$argon2id\$/);
});

// ───── RNF-26 ─────
test('los enlaces firmados de archivos vencen a los 5 minutos', () => {
  const url = signFileUrl(123);
  const exp = Number(new URL(url, 'http://x').searchParams.get('exp'));
  const restante = exp - Math.floor(Date.now() / 1000);
  assert.ok(restante > 290 && restante <= 300, `vigencia ${restante} s`);
});

// ───── RNF-04 ─────
test('la sesión del cliente se cierra tras 3 minutos sin actividad', async () => {
  const u = await createUser({ rol: 1 });
  const token = await login(server.url, u);
  const sid = sesionDe(token);
  await envejecer(sid, 2);
  assert.equal((await api(server.url, 'GET', '/api/me', { token })).status, 200, 'a los 2 min sigue activa');

  await envejecer(sid, 4);
  const r = await api(server.url, 'GET', '/api/me', { token });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'AUTH_IDLE');
  const estado = (await getPool().query('SELECT estado FROM sesiones_activas WHERE id_sesion = $1', [sid])).rows[0].estado;
  assert.equal(estado, 'inactiva');
  assert.equal((await api(server.url, 'GET', '/api/me', { token })).status, 401, 'ya no se puede reutilizar');
});

test('cada petición de la persona renueva la actividad; el latido del técnico no', async () => {
  const tecnico = await createUser({ rol: 2, latitud: 17.96, longitud: -102.2, disponible: true });
  const token = await login(server.url, tecnico);
  const sid = sesionDe(token);
  const actividad = async () => Number((await getPool().query(
    'SELECT EXTRACT(EPOCH FROM (NOW() - ultima_actividad))::int AS s FROM sesiones_activas WHERE id_sesion = $1', [sid]
  )).rows[0].s);

  await envejecer(sid, 2);
  await api(server.url, 'POST', '/api/tecnico/latido', { token, body: { latitud: 17.96, longitud: -102.2 } });
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(await actividad() >= 110, 'el latido automático no cuenta como actividad');

  await api(server.url, 'GET', '/api/me', { token });
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(await actividad() < 10, 'una petición de la persona sí la renueva');
});

test('el panel de administrador no se cierra por esta regla', async () => {
  const admin = await createUser({ rol: 3 });
  const sid = randomUUID();
  await getPool().query(
    "INSERT INTO sesiones_activas (id_sesion, id_usuario, dispositivo, estado, id_rol, ultima_actividad) VALUES ($1, $2, 'prueba', 'activa', 3, NOW() - interval '30 minutes')",
    [sid, admin.id]
  );
  const token = signSession({ id_usuario: admin.id, id_rol: 3, version_sesion: 1, sessionId: sid });
  assert.equal((await api(server.url, 'GET', '/api/me', { token })).status, 200);
});
