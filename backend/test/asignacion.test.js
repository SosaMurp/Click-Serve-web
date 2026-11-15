const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, idem, getPool, closePool } = require('./helpers');
const { barrerAsignaciones } = require('../src/services/asignacion');

let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

// Domicilio del cliente y tres técnicos: a ~0.2 km, a ~3.5 km y a ~70 km (fuera del radio de 25 km).
const CASA = { latitud: 17.958, longitud: -102.199 };

async function usuario(rol, opts = {}) {
  const u = await createUser({ rol, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function escenario() {
  // Cada prueba empieza sin otros técnicos en línea.
  await getPool().query('UPDATE usuarios SET disponible = false WHERE id_rol = 2');
  const c = await usuario(1);
  const lejos = await usuario(2, { nombre: 'Lejos', latitud: 18.6, longitud: -102.2, disponible: true });
  const medio = await usuario(2, { nombre: 'Medio', latitud: 17.99, longitud: -102.2, disponible: true });
  const cerca = await usuario(2, { nombre: 'Cerca', latitud: 17.96, longitud: -102.2, disponible: true });
  const s = (await api(server.url, 'POST', '/api/solicitudes', {
    token: c.token, headers: idem(),
    body: { categoria: 'ELECTRICIDAD', descripcion: 'El contacto de la cocina hace chispa.', direccion: 'Av. Lázaro Cárdenas 120, Centro', ...CASA },
  })).body.solicitud;
  return { c, lejos, medio, cerca, id: s.id_solicitud };
}

const propuesto = async (id) => (await getPool().query('SELECT id_tecnico_propuesto FROM solicitudes_servicio WHERE id_solicitud = $1', [id])).rows[0].id_tecnico_propuesto;
const nuevas = async (t) => (await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: t.token })).body.solicitudes.map((x) => x.id_solicitud);

test('búsqueda automática: se propone al técnico más cercano dentro del radio', async () => {
  const { c, lejos, medio, cerca, id } = await escenario();
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/busqueda-automatica`, { token: c.token });
  assert.equal(res.status, 200);
  assert.match(res.body.mensaje, /Cerca/);
  assert.equal(await propuesto(id), cerca.id);
  // Mientras la propuesta está vigente, nadie más la ve; el lejano nunca, y tampoco puede aceptarla.
  assert.ok((await nuevas(cerca)).includes(id));
  assert.ok(!(await nuevas(medio)).includes(id));
  assert.ok(!(await nuevas(lejos)).includes(id));
  const acepta = await api(server.url, 'POST', `/api/solicitudes/${id}/aceptar`, { token: lejos.token });
  assert.equal(acepta.status, 409);
});

test('búsqueda automática en cascada: si no acepta a tiempo o la descarta, pasa al siguiente más cercano', async () => {
  const { c, medio, cerca, id } = await escenario();
  await api(server.url, 'POST', `/api/solicitudes/${id}/busqueda-automatica`, { token: c.token });
  assert.equal(await propuesto(id), cerca.id);

  // Vence el tiempo del más cercano: el barrido la propone al siguiente.
  await getPool().query("UPDATE solicitudes_servicio SET propuesto_hasta = NOW() - INTERVAL '1 minute' WHERE id_solicitud = $1", [id]);
  await barrerAsignaciones();
  assert.equal(await propuesto(id), medio.id);
  const vencida = await getPool().query('SELECT resultado FROM intentos_asignacion WHERE id_solicitud = $1 AND id_tecnico = $2', [id, cerca.id]);
  assert.equal(vencida.rows[0].resultado, 'VENCIDA');

  // El siguiente la descarta y ya no queda nadie dentro del radio (el lejano no cuenta).
  assert.equal((await api(server.url, 'POST', `/api/solicitudes/${id}/descartar`, { token: medio.token })).status, 200);
  assert.equal(await propuesto(id), null);
  const intentos = await getPool().query('SELECT id_tecnico FROM intentos_asignacion WHERE id_solicitud = $1 ORDER BY fecha', [id]);
  assert.deepEqual(intentos.rows.map((r) => r.id_tecnico), [cerca.id, medio.id]);
});

test('el técnico propuesto acepta y la solicitud queda asignada a él', async () => {
  const { c, cerca, id } = await escenario();
  await api(server.url, 'POST', `/api/solicitudes/${id}/busqueda-automatica`, { token: c.token });
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/aceptar`, { token: cerca.token });
  assert.equal(res.status, 200);
  // Precio base: asignada a él, la orden espera que el cliente pague su precio en custodia.
  assert.equal(res.body.solicitud.estado, 'ESPERANDO_APROBACION');
  assert.equal(res.body.solicitud.id_tecnico, cerca.id);
  assert.ok(Number(res.body.solicitud.precio_base) > 0);
});

test('recomendados y propuesta manual respetan el radio', async () => {
  const { c, lejos, cerca, id } = await escenario();
  const rec = await api(server.url, 'GET', `/api/tecnicos/recomendados?id_solicitud=${id}`, { token: c.token });
  const ids = rec.body.tecnicos.map((t) => t.id_usuario);
  assert.equal(ids[0], cerca.id, 'el más cercano va primero');
  assert.ok(!ids.includes(lejos.id));
  const prop = await api(server.url, 'POST', `/api/solicitudes/${id}/proponer-tecnico`, { token: c.token, body: { id_tecnico: lejos.id } });
  assert.equal(prop.status, 409);
  assert.equal(prop.body.code, 'OUT_OF_RANGE');
});
