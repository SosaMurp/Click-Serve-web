const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');

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

test('búsqueda: encuentra técnicos aprobados por nombre y oculta los no verificados', async () => {
  const visible = await as(2, { nombre: 'Lupita' });
  await as(2, { nombre: 'Lupita', aprobado: false });
  const cliente = await as(1);
  const res = await api(server.url, 'GET', '/api/tecnicos/buscar?q=lupi', { token: cliente.token });
  assert.equal(res.status, 200);
  const ids = res.body.tecnicos.map((t) => t.id_usuario);
  assert.ok(ids.includes(visible.id));
  assert.equal(res.body.tecnicos.every((t) => !('latitud' in t) && !('telefono' in t)), true);
});

test('búsqueda: una sola letra se rechaza y los comodines no cuentan como comodines', async () => {
  const cliente = await as(1);
  const corta = await api(server.url, 'GET', '/api/tecnicos/buscar?q=a', { token: cliente.token });
  assert.equal(corta.status, 400);
  const comodin = await api(server.url, 'GET', '/api/tecnicos/buscar?q=%25%25', { token: cliente.token });
  assert.equal(comodin.status, 200);
  assert.equal(comodin.body.tecnicos.length, 0);
});

test('búsqueda: solo clientes pueden buscar', async () => {
  const tecnico = await as(2);
  const res = await api(server.url, 'GET', '/api/tecnicos/buscar?q=prueba', { token: tecnico.token });
  assert.equal(res.status, 403);
});

test('mensaje directo: el cliente abre la conversación una sola vez y se puede escribir', async () => {
  const cliente = await as(1);
  const tecnico = await as(2, { nombre: 'Directo' });
  const primera = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: tecnico.id } });
  assert.equal(primera.status, 201);
  const segunda = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: tecnico.id } });
  assert.equal(segunda.body.conversacion.id_conversacion, primera.body.conversacion.id_conversacion);

  const id = primera.body.conversacion.id_conversacion;
  await api(server.url, 'POST', `/api/chat-directo/${id}/politicas`, { token: tecnico.token });
  const envio =await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: tecnico.token, body: { mensaje: 'Hola, ¿a qué hora llego?' } });
  assert.equal(envio.status, 201);
  const hilo = await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: cliente.token });
  assert.equal(hilo.body.mensajes.length, 1);
  assert.equal(hilo.body.mensajes[0].mensaje, 'Hola, ¿a qué hora llego?');
});

test('mensaje directo: un tercero no puede leer ni escribir la conversación', async () => {
  const cliente = await as(1);
  const tecnico = await as(2);
  const extraño = await as(1);
  const abierta = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: tecnico.id } });
  const id = abierta.body.conversacion.id_conversacion;
  const leer = await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: extraño.token });
  assert.equal(leer.status, 403);
  const escribir = await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: extraño.token, body: { mensaje: 'hola' } });
  assert.equal(escribir.status, 403);
});

test('mensaje directo: no se abre con un técnico no visible ni con uno mismo', async () => {
  const cliente = await as(1);
  const pendiente = await as(2, { aprobado: false });
  const noVisible = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: pendiente.id } });
  assert.equal(noVisible.status, 404);
  const yo = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: cliente.id } });
  assert.equal(yo.status, 400);
});

test('mensaje directo: el técnico no puede iniciar una conversación', async () => {
  const tecnico = await as(2);
  const otro = await as(2);
  const res = await api(server.url, 'POST', '/api/chat-directo', { token: tecnico.token, body: { id_tecnico: otro.id } });
  assert.equal(res.status, 403);
  const rows = await getPool().query('SELECT COUNT(*)::int AS n FROM conversaciones_directas WHERE id_tecnico = $1', [otro.id]);
  assert.equal(rows.rows[0].n, 0);
});

test('chat directo: solo 3 mensajes por persona antes de contratar; el cuarto se rechaza con el camino a seguir', async () => {
  const cliente = await as(1);
  const tecnico = await as(2);
  const abierta = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: tecnico.id } });
  const id = abierta.body.conversacion.id_conversacion;
  for (const u of [cliente, tecnico]) await api(server.url, 'POST', `/api/chat-directo/${id}/politicas`, { token: u.token });
  const ini = await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: cliente.token });
  assert.deepEqual([ini.body.limite, ini.body.restantes, ini.body.id_tecnico], [3, 3, tecnico.id]);
  for (let i = 1; i <= 3; i += 1) {
    const r = await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: cliente.token, body: { mensaje: `Pregunta ${i}` } });
    assert.equal(r.status, 201);
    assert.equal(r.body.restantes, 3 - i);
  }
  const cuarto = await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: cliente.token, body: { mensaje: 'Nos vemos en la plaza' } });
  assert.equal(cuarto.status, 409);
  assert.equal(cuarto.body.code, 'CHAT_DIRECTO_LIMITE');
  assert.match(cuarto.body.error, /pide el servicio/);
  // El técnico tiene su propio cupo.
  const resp = await api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: tecnico.token, body: { mensaje: 'Claro, pídeme el servicio' } });
  assert.equal(resp.status, 201);
  // Pasada la ventana de 30 días vuelve a tener cupo.
  await getPool().query("UPDATE mensajes_directos SET fecha_envio = fecha_envio - INTERVAL '31 days' WHERE id_emisor = $1", [cliente.id]);
  assert.equal((await api(server.url, 'GET', `/api/chat-directo/${id}/mensajes`, { token: cliente.token })).body.restantes, 3);
});
