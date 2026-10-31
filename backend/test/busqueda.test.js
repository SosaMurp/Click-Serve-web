const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');

// Búsqueda global del panel segmentada por técnicos, clientes y servicios (RF-44).
let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

test('la búsqueda separa técnicos, clientes y servicios', async () => {
  const admin = await createUser({ rol: 3 });
  const adminToken = await login(server.url, admin);
  const cliente = await createUser({ rol: 1, nombre: 'Zacarías' });
  const tecnico = await createUser({ rol: 2, nombre: 'Zacarías' });
  await getPool().query(
    `INSERT INTO solicitudes_servicio (folio, id_usuario, id_tecnico, descripcion, direccion, estado)
     VALUES ('SRV-ZAC-1', $1, $2, 'Reparar el boiler de Zacarías', 'Calle 5', 'ASIGNADA')`,
    [cliente.id, tecnico.id]
  );

  const todos = await api(server.url, 'GET', '/api/admin/buscar?q=Zacar', { token: adminToken });
  assert.equal(todos.status, 200);
  assert.deepEqual(todos.body.tecnicos.map((u) => u.id_usuario), [tecnico.id]);
  assert.deepEqual(todos.body.clientes.map((u) => u.id_usuario), [cliente.id]);
  assert.equal(todos.body.servicios[0].folio, 'SRV-ZAC-1');

  const soloTecnicos = await api(server.url, 'GET', '/api/admin/buscar?q=Zacar&tipo=tecnicos', { token: adminToken });
  assert.equal(soloTecnicos.body.tecnicos.length, 1);
  assert.equal(soloTecnicos.body.clientes.length, 0);
  assert.equal(soloTecnicos.body.servicios.length, 0);

  const porFolio = await api(server.url, 'GET', '/api/admin/buscar?q=srv-zac&tipo=servicios', { token: adminToken });
  assert.equal(porFolio.body.servicios.length, 1);
});

test('busca con comodines literales, exige 2 letras, valida el tipo y es solo para administradores', async () => {
  const admin = await createUser({ rol: 3 });
  const adminToken = await login(server.url, admin);
  const cliente = await createUser({ rol: 1 });
  const clienteToken = await login(server.url, cliente);

  const comodin = await api(server.url, 'GET', '/api/admin/buscar?q=%25%25', { token: adminToken });
  assert.equal(comodin.status, 200);
  assert.equal(comodin.body.tecnicos.length + comodin.body.clientes.length + comodin.body.servicios.length, 0, '% no es un comodín');
  assert.deepEqual((await api(server.url, 'GET', '/api/admin/buscar?q=a', { token: adminToken })).body.tecnicos, []);
  assert.equal((await api(server.url, 'GET', '/api/admin/buscar?q=ab&tipo=otros', { token: adminToken })).status, 400);
  assert.equal((await api(server.url, 'GET', '/api/admin/buscar?q=ab', { token: clienteToken })).status, 403);
  assert.equal((await api(server.url, 'GET', '/api/admin/buscar?q=ab')).status, 401);
});
