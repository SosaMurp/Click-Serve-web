const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');

let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

async function as(rol, opts = {}) {
  const u = await createUser({ rol, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function solicitud(cliente, tecnico, estado) {
  const { rows } = await getPool().query(
    `INSERT INTO solicitudes_servicio (folio, id_usuario, id_tecnico, categoria, descripcion, direccion, estado)
     VALUES ($1, $2, $3, 'PLOMERIA', 'Fuga en el baño', 'Calle 1', $4) RETURNING id_solicitud`,
    [`SRV-T${Math.random().toString(36).slice(2, 8)}`, cliente, tecnico, estado]
  );
  return rows[0].id_solicitud;
}

test('el panel inicia sesión con código por correo y recibe el perfil del administrador', async () => {
  const admin = await createUser({ rol: 3, nombre: 'Ana' });
  const paso1 = await api(server.url, 'POST', '/api/login-admin', { body: { email: admin.email, password: admin.password } });
  assert.equal(paso1.status, 200);
  assert.equal(paso1.body.requiere2FA, true);
  const { rows } = await getPool().query(
    "SELECT token FROM tokens_temporales WHERE id_usuario = $1 AND tipo_accion = 'login_admin' AND estado_uso = 'sin usar'",
    [admin.id]
  );
  const paso2 = await api(server.url, 'POST', '/api/verify-login-admin', { body: { email: admin.email, token: rows[0].token } });
  assert.equal(paso2.status, 200);
  assert.equal(paso2.body.usuario.nombre, 'Ana');
  assert.equal(paso2.body.usuario.correo, admin.email);
  assert.equal((await api(server.url, 'GET', '/api/admin/dashboard/stats', { token: paso2.body.token })).status, 200);

  const cliente = await createUser({ rol: 1 });
  const noAdmin = await api(server.url, 'POST', '/api/login-admin', { body: { email: cliente.email, password: cliente.password } });
  assert.equal(noAdmin.status, 403);
});

test('el dashboard cuenta con los datos de la app', async () => {
  const admin = await as(3);
  const cliente = await as(1);
  const tecnico = await createUser({ rol: 2, latitud: 17.96, longitud: -102.2, disponible: true });
  await createUser({ rol: 2, aprobado: false });
  await solicitud(cliente.id, tecnico.id, 'EN_CAMINO');
  await solicitud(cliente.id, tecnico.id, 'FINALIZADA');

  const stats = await api(server.url, 'GET', '/api/admin/dashboard/stats', { token: admin.token });
  assert.equal(stats.status, 200);
  assert.equal(stats.body.tecnicos_online, 1);
  assert.equal(stats.body.servicios_en_curso, 1);
  assert.equal(stats.body.validaciones_pendientes, 1);
  assert.equal(stats.body.servicios_completados_mes, 1);

  const mes = await api(server.url, 'GET', '/api/admin/dashboard/servicios-mes', { token: admin.token });
  assert.equal(mes.body.puntos.length, 30);
  assert.equal(mes.body.total_completados, 1);

  const recientes = await api(server.url, 'GET', '/api/admin/dashboard/recent-services?limit=5', { token: admin.token });
  assert.equal(recientes.body.servicios.length, 2);
  assert.ok(recientes.body.servicios.every((s) => ['En Curso', 'Completado'].includes(s.estatus)));
  assert.equal(recientes.body.servicios[0].titulo, 'Plomería');

  const actividad = await api(server.url, 'GET', '/api/admin/dashboard/actividad', { token: admin.token });
  assert.ok(actividad.body.items.length >= 3);
  const esp = await api(server.url, 'GET', '/api/admin/dashboard/especialidades', { token: admin.token });
  assert.equal(esp.body[0].especialidad, 'Plomería');
});

test('el buscador del panel abre un servicio y solo permite cancelarlo sin cargo', async () => {
  const admin = await as(3);
  const cliente = await as(1);
  const tecnico = await as(2);
  const id = await solicitud(cliente.id, tecnico.id, 'ASIGNADA');

  const detalle = await api(server.url, 'GET', `/api/admin/solicitudes/${id}`, { token: admin.token });
  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.estatus, 'En Curso');
  assert.equal((await api(server.url, 'GET', '/api/admin/solicitudes/999999', { token: admin.token })).status, 404);

  const avanzar = await api(server.url, 'PATCH', `/api/admin/solicitudes/${id}/estado`, { token: admin.token, body: { estatus: 'Finalizado' } });
  assert.equal(avanzar.status, 409);
  const cancelar = await api(server.url, 'PATCH', `/api/admin/solicitudes/${id}/estado`, { token: admin.token, body: { estatus: 'Cancelado', motivoCambio: 'Cliente lo pidió por teléfono' } });
  assert.equal(cancelar.status, 200);
  const orden = (await getPool().query('SELECT estado, cancelado_por FROM solicitudes_servicio WHERE id_solicitud = $1', [id])).rows[0];
  assert.deepEqual(orden, { estado: 'CANCELADA', cancelado_por: 'ADMIN' });
});

test('directorio: filtrar, suspender, reactivar, exportar, coadmin y baja con contraseña', async () => {
  const admin = await as(3);
  const tecnico = await as(2, { nombre: 'Rogelio' });

  const tecnicos = await api(server.url, 'GET', '/api/admin/users?role=tech&search=Rogelio', { token: admin.token });
  assert.equal(tecnicos.status, 200);
  assert.equal(tecnicos.body.length, 1);
  assert.equal(tecnicos.body[0].estatus_expediente, 'Aprobado');

  assert.equal((await api(server.url, 'POST', `/api/admin/users/${tecnico.id}/suspend`, { token: admin.token })).status, 200);
  assert.equal((await api(server.url, 'GET', '/api/me', { token: tecnico.token })).status, 401);
  assert.equal((await api(server.url, 'POST', '/api/login', { body: { email: tecnico.email, password: tecnico.password } })).status, 403);
  assert.equal((await api(server.url, 'POST', `/api/admin/users/${tecnico.id}/reactivate`, { token: admin.token })).status, 200);
  assert.equal((await api(server.url, 'POST', '/api/login', { body: { email: tecnico.email, password: tecnico.password } })).status, 200);

  const exp = await api(server.url, 'GET', `/api/admin/users/${tecnico.id}/export`, { token: admin.token });
  assert.equal(exp.status, 200);
  assert.equal(exp.body.expediente_completo.usuario.id_usuario, tecnico.id);
  assert.equal(exp.body.expediente_completo.usuario.contrasena, undefined);

  const debil = await api(server.url, 'POST', '/api/admin/co-admins', { token: admin.token, body: { nombre: 'Co', apellidos: 'Admin', email: 'co@prueba.test', password: '123' } });
  assert.equal(debil.status, 400);
  const co = await api(server.url, 'POST', '/api/admin/co-admins', { token: admin.token, body: { nombre: 'Co', apellidos: 'Admin', email: 'co@prueba.test', password: 'Prueba#2026' } });
  assert.equal(co.status, 201);
  assert.equal((await api(server.url, 'POST', '/api/login-admin', { body: { email: 'co@prueba.test', password: 'Prueba#2026' } })).status, 200);

  const sinClave = await api(server.url, 'DELETE', `/api/admin/users/${tecnico.id}`, { token: admin.token, body: {} });
  assert.equal(sinClave.status, 403);
  const baja = await api(server.url, 'DELETE', `/api/admin/users/${tecnico.id}`, { token: admin.token, body: { password: admin.password } });
  assert.equal(baja.status, 200);
  const anon = (await getPool().query('SELECT anonimizado, nombre FROM usuarios WHERE id_usuario = $1', [tecnico.id])).rows[0];
  assert.deepEqual(anon, { anonimizado: true, nombre: 'Usuario' });
});
