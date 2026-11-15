const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, idem, getPool, closePool } = require('./helpers');

// Catálogo de servicios: precio base por servicio, precios del técnico (rango y un cambio por semana)
// y administración del catálogo desde el panel.
let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

async function como(rol, opts = {}) {
  const u = await createUser({ rol, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function admin() {
  const a = await createUser({ rol: 3 });
  const { rows } = await getPool().query("INSERT INTO sesiones_activas (id_usuario, id_rol, dispositivo) VALUES ($1, 3, 'test') RETURNING id_sesion", [a.id]);
  const { signSession } = require('../src/lib/tokens');
  return { ...a, token: signSession({ id_usuario: a.id, id_rol: 3, version_sesion: 1, sessionId: rows[0].id_sesion }) };
}

async function servicio(categoria, nombre) {
  const { rows } = await getPool().query('SELECT * FROM servicios_catalogo WHERE categoria = $1 AND nombre = $2', [categoria, nombre]);
  return rows[0];
}

const solicitud = (token, body) => api(server.url, 'POST', '/api/solicitudes', {
  token, headers: idem(),
  body: { descripcion: 'El boiler ya no calienta y quiero cambiarlo.', direccion: 'Calle 8 #3, Centro', latitud: 17.958, longitud: -102.2, ...body },
});

test('las categorías traen su catálogo de servicios con rango y precio sugerido', async () => {
  const c = await como(1);
  const r = await api(server.url, 'GET', '/api/categorias', { token: c.token });
  const plomeria = r.body.categorias.find((x) => x.codigo === 'PLOMERIA');
  assert.ok(plomeria.servicios.length >= 4);
  const calentador = plomeria.servicios.find((s) => s.nombre === 'Instalar calentador');
  assert.deepEqual([calentador.precio_min, calentador.precio_max, calentador.precio_sugerido], ['800.00', '2000.00', '1200.00']);
  assert.ok(plomeria.servicios.some((s) => s.es_diagnostico), 'cada categoría tiene visita de diagnóstico');
});

test('el técnico fija su precio por servicio: dentro del rango, un cambio por semana y el diagnóstico es fijo', async () => {
  const t = await como(2);
  const calentador = await servicio('PLOMERIA', 'Instalar calentador');
  const diag = await servicio('PLOMERIA', 'Visita de diagnóstico');
  const lista = await api(server.url, 'GET', '/api/tecnico/precios', { token: t.token });
  assert.equal(lista.body.servicios.find((s) => s.id_servicio === calentador.id_servicio).precio, '1200.00', 'sin precio propio, el sugerido');
  assert.equal((await api(server.url, 'PATCH', `/api/tecnico/precios/${calentador.id_servicio}`, { token: t.token, body: { precio: '5000' } })).status, 400);
  const ok = await api(server.url, 'PATCH', `/api/tecnico/precios/${calentador.id_servicio}`, { token: t.token, body: { precio: '1500' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.servicios.find((s) => s.id_servicio === calentador.id_servicio).precio, '1500.00');
  const otra = await api(server.url, 'PATCH', `/api/tecnico/precios/${calentador.id_servicio}`, { token: t.token, body: { precio: '1600' } });
  assert.equal(otra.status, 409);
  assert.equal(otra.body.code, 'PRICE_LOCKED');
  assert.ok(otra.body.cambiar_desde);
  const fijo = await api(server.url, 'PATCH', `/api/tecnico/precios/${diag.id_servicio}`, { token: t.token, body: { precio: '300' } });
  assert.equal(fijo.body.code, 'FIXED_PRICE');
  // Pasada la semana sí puede cambiarlo.
  await getPool().query("UPDATE precios_tecnico SET fecha_actualizacion = NOW() - INTERVAL '8 days' WHERE id_usuario = $1", [t.id]);
  assert.equal((await api(server.url, 'PATCH', `/api/tecnico/precios/${calentador.id_servicio}`, { token: t.token, body: { precio: '1600' } })).status, 200);
});

test('la solicitud con servicio cobra el precio de ese servicio del técnico que acepta', async () => {
  const c = await como(1);
  const t = await como(2, { latitud: 17.96, longitud: -102.2, disponible: true });
  const calentador = await servicio('PLOMERIA', 'Instalar calentador');
  await getPool().query('INSERT INTO precios_tecnico (id_usuario, id_servicio, precio) VALUES ($1, $2, 1500)', [t.id, calentador.id_servicio]);
  const mala = await solicitud(c.token, { categoria: 'ELECTRICIDAD', id_servicio: calentador.id_servicio });
  assert.equal(mala.status, 400, 'el servicio debe ser de la categoría elegida');
  const s = await solicitud(c.token, { id_servicio: calentador.id_servicio });
  assert.equal(s.status, 201);
  assert.equal(s.body.solicitud.categoria, 'PLOMERIA', 'la categoría sale del servicio');
  assert.equal(s.body.solicitud.servicio_nombre, 'Instalar calentador');
  const nuevas = await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: t.token });
  assert.equal(nuevas.body.solicitudes.find((x) => x.id_solicitud === s.body.solicitud.id_solicitud).mi_precio, '1500.00');
  const rec = await api(server.url, 'GET', `/api/tecnicos/recomendados?id_solicitud=${s.body.solicitud.id_solicitud}`, { token: c.token });
  assert.equal(rec.body.tecnicos.find((x) => x.id_usuario === t.id).precio_base, '1500.00');
  const acepta = await api(server.url, 'POST', `/api/solicitudes/${s.body.solicitud.id_solicitud}/aceptar`, { token: t.token });
  assert.equal(acepta.status, 200);
  assert.equal(acepta.body.solicitud.precio_base, '1500.00');
  const det = await api(server.url, 'GET', `/api/solicitudes/${s.body.solicitud.id_solicitud}`, { token: c.token });
  assert.equal(det.body.solicitud.cotizacion.conceptos[0].descripcion, 'Precio base · Instalar calentador');
});

test('el administrador maneja el catálogo; si baja un rango, el precio del técnico se ajusta al nuevo máximo', async () => {
  const a = await admin();
  const c = await como(1);
  assert.equal((await api(server.url, 'POST', '/api/admin/servicios', { token: c.token, body: {} })).status, 403);
  const nuevo = await api(server.url, 'POST', '/api/admin/servicios', {
    token: a.token, body: { categoria: 'PLOMERIA', nombre: 'Instalar tinaco', precio_min: 600, precio_max: 1800, precio_sugerido: 900 },
  });
  assert.equal(nuevo.status, 201);
  const malo = await api(server.url, 'PATCH', `/api/admin/servicios/${nuevo.body.servicio.id_servicio}`, { token: a.token, body: { precio_sugerido: 5000 } });
  assert.equal(malo.status, 400);
  const t = await como(2);
  await api(server.url, 'PATCH', `/api/tecnico/precios/${nuevo.body.servicio.id_servicio}`, { token: t.token, body: { precio: '1700' } });
  const baja = await api(server.url, 'PATCH', `/api/admin/servicios/${nuevo.body.servicio.id_servicio}`, { token: a.token, body: { precio_max: 1200, precio_sugerido: 900 } });
  assert.equal(baja.status, 200);
  const lista = await api(server.url, 'GET', '/api/tecnico/precios', { token: t.token });
  assert.equal(lista.body.servicios.find((s) => s.id_servicio === nuevo.body.servicio.id_servicio).precio, '1200.00');
  const off = await api(server.url, 'PATCH', `/api/admin/servicios/${nuevo.body.servicio.id_servicio}`, { token: a.token, body: { activo: false } });
  assert.equal(off.body.servicio.activo, false);
  const cat = await api(server.url, 'GET', '/api/categorias', { token: c.token });
  assert.ok(!cat.body.categorias.find((x) => x.codigo === 'PLOMERIA').servicios.some((s) => s.nombre === 'Instalar tinaco'), 'el servicio desactivado no se ofrece');
});
