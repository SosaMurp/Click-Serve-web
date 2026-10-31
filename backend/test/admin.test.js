const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, idem, getPool, closePool } = require('./helpers');
const { invalidateConfig } = require('../src/services/config');

let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });
test.afterEach(async () => {
  // Cada prueba deja la configuración como la encontró.
  await getPool().query(
    `UPDATE configuracion_plataforma SET comision_porcentaje = 10, monto_minimo_retiro = 100, radio_maximo_km = 25,
       tolerancia_minutos = 10, modo_mantenimiento = false WHERE id = 1`
  );
  invalidateConfig();
});

async function as(rol, opts = {}) {
  const u = await createUser({ rol, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function walletFor(idUsuario, saldo) {
  await getPool().query(
    `INSERT INTO billetera_tecnico (id_usuario, saldo_actual, clabe_interbancaria, banco)
     VALUES ($1, $2, '002010077777777771', 'Banamex')
     ON CONFLICT (id_usuario) DO UPDATE SET saldo_actual = EXCLUDED.saldo_actual, clabe_interbancaria = EXCLUDED.clabe_interbancaria`,
    [idUsuario, saldo]
  );
}

const saldoDe = async (idUsuario) =>
  (await getPool().query('SELECT saldo_actual FROM billetera_tecnico WHERE id_usuario = $1', [idUsuario])).rows[0].saldo_actual;

test('solo un administrador entra a las rutas del panel', async () => {
  const cliente = await as(1);
  for (const [method, path] of [['GET', '/api/admin/tecnicos'], ['GET', '/api/admin/retiros'], ['GET', '/api/admin/incidencias'], ['GET', '/api/admin/configuracion']]) {
    const res = await api(server.url, method, path, { token: cliente.token });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
  assert.equal((await api(server.url, 'GET', '/api/admin/tecnicos')).status, 401);
});

test('el técnico que se registra en la app aparece en pendientes y al aprobarlo pasa a aprobados', async () => {
  const admin = await as(3);
  const tecnico = await createUser({ rol: 2, aprobado: false, nombre: 'Pendiente' });
  await getPool().query("UPDATE usuarios SET estado_cuenta = 'Activo' WHERE id_usuario = $1", [tecnico.id]);

  const pendientes = await api(server.url, 'GET', '/api/admin/tecnicos?estado=pendientes', { token: admin.token });
  assert.equal(pendientes.status, 200);
  assert.ok(pendientes.body.tecnicos.some((t) => t.id_usuario === tecnico.id));

  const exp = await api(server.url, 'GET', `/api/admin/usuarios/${tecnico.id}/expediente`, { token: admin.token });
  assert.equal(exp.status, 200);
  assert.equal(exp.body.expediente.id_usuario, tecnico.id);
  assert.ok(Array.isArray(exp.body.expediente.documentos));

  const ok = await api(server.url, 'PATCH', `/api/admin/usuarios/${tecnico.id}/aprobar`, { token: admin.token });
  assert.equal(ok.status, 200);
  const aprobados = await api(server.url, 'GET', '/api/admin/tecnicos?estado=aprobados', { token: admin.token });
  assert.ok(aprobados.body.tecnicos.some((t) => t.id_usuario === tecnico.id));
});

test('rechazar con bloqueo cierra las sesiones y la app ya no deja entrar', async () => {
  const admin = await as(3);
  const tecnico = await as(2, { aprobado: false });

  const sinMotivo = await api(server.url, 'PATCH', `/api/admin/usuarios/${tecnico.id}/rechazar`, { token: admin.token, body: {} });
  assert.equal(sinMotivo.status, 400);

  const res = await api(server.url, 'PATCH', `/api/admin/usuarios/${tecnico.id}/rechazar`, {
    token: admin.token, body: { motivo: 'Sospecha de fraude', bloquear: true },
  });
  assert.equal(res.status, 200);
  assert.equal((await api(server.url, 'GET', '/api/me', { token: tecnico.token })).status, 401);
  const relogin = await api(server.url, 'POST', '/api/login', { body: { email: tecnico.email, password: tecnico.password } });
  assert.equal(relogin.status, 403);
  assert.equal(relogin.body.code, 'ACCOUNT_SUSPENDED');

  const suspendidos = await api(server.url, 'GET', '/api/admin/tecnicos?estado=suspendidos', { token: admin.token });
  const fila = suspendidos.body.tecnicos.find((t) => t.id_usuario === tecnico.id);
  assert.equal(fila.motivo_rechazo, 'Sospecha de fraude');
});

test('tesorería ve los retiros de la app, autoriza uno y al rechazar otro el saldo regresa', async () => {
  const admin = await as(3);
  const tecnico = await as(2);
  await walletFor(tecnico.id, '500.00');

  const r1 = await api(server.url, 'POST', '/api/billetera/retiro', { token: tecnico.token, body: { monto: '150.00' }, headers: idem() });
  const r2 = await api(server.url, 'POST', '/api/billetera/retiro', { token: tecnico.token, body: { monto: '200.00' }, headers: idem() });
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);
  assert.equal(await saldoDe(tecnico.id), '150.0000');

  const lista = await api(server.url, 'GET', '/api/admin/retiros?estado=EN_PROCESO', { token: admin.token });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.retiros.length, 2);
  assert.ok(!lista.body.retiros[0].clabe_destino.startsWith('0020100777'), 'la CLABE completa no sale del servidor');

  const id1 = r1.body.transaccion.id_transaccion;
  const id2 = r2.body.transaccion.id_transaccion;
  assert.equal((await api(server.url, 'POST', `/api/admin/retiros/${id1}/aprobar`, { token: admin.token })).status, 200);
  assert.equal((await api(server.url, 'POST', `/api/admin/retiros/${id1}/aprobar`, { token: admin.token })).status, 409, 'no se procesa dos veces');

  assert.equal((await api(server.url, 'POST', `/api/admin/retiros/${id2}/rechazar`, { token: admin.token, body: {} })).status, 400);
  const rechazo = await api(server.url, 'POST', `/api/admin/retiros/${id2}/rechazar`, { token: admin.token, body: { motivo: 'CLABE a nombre de otra persona' } });
  assert.equal(rechazo.status, 200);
  assert.equal(await saldoDe(tecnico.id), '350.0000');

  const mov = await api(server.url, 'GET', '/api/billetera/movimientos?tipo=RETIRO', { token: tecnico.token });
  const estados = Object.fromEntries(mov.body.movimientos.map((m) => [m.id_transaccion, m.estado]));
  assert.equal(estados[id1], 'COMPLETADO');
  assert.equal(estados[id2], 'RECHAZADO');
});

test('soporte clasifica una incidencia y la cierra; la orden suspendida continúa', async () => {
  const admin = await as(3);
  const cliente = await as(1);
  const tecnico = await as(2);
  const { rows } = await getPool().query(
    `INSERT INTO solicitudes_servicio (folio, id_usuario, id_tecnico, descripcion, direccion, estado)
     VALUES ('SRV-ADMIN-1', $1, $2, 'Fuga en el baño', 'Calle 1', 'ASIGNADA') RETURNING id_solicitud`,
    [cliente.id, tecnico.id]
  );
  const idSolicitud = rows[0].id_solicitud;
  const rep = await api(server.url, 'POST', `/api/solicitudes/${idSolicitud}/incidencias`, {
    token: cliente.token, body: { tipo: 'MALA_CALIDAD', descripcion: 'El técnico dejó la fuga peor que antes.' },
  });
  assert.equal(rep.status, 201);
  const idInc = rep.body.incidencia.id_incidencia;

  const lista = await api(server.url, 'GET', '/api/admin/incidencias?estado=ABIERTA', { token: admin.token });
  const fila = lista.body.incidencias.find((i) => i.id_incidencia === idInc);
  assert.equal(fila.cliente_nombre, 'Cliente');
  assert.equal(fila.estado_solicitud, 'SUSPENDIDA');

  const clasif = await api(server.url, 'PATCH', `/api/admin/incidencias/${idInc}`, {
    token: admin.token, body: { prioridad: 'ALTA', notas_admin: 'Se llamó al cliente.' },
  });
  assert.equal(clasif.status, 200);
  assert.equal(clasif.body.incidencia.prioridad, 'ALTA');
  assert.equal(clasif.body.incidencia.estado, 'ABIERTA');

  const cerrar = await api(server.url, 'PATCH', `/api/admin/incidencias/${idInc}`, { token: admin.token, body: { accion: 'CONTINUAR' } });
  assert.equal(cerrar.status, 200);
  assert.equal(cerrar.body.incidencia.estado, 'RESUELTA');
  const orden = (await getPool().query('SELECT estado FROM solicitudes_servicio WHERE id_solicitud = $1', [idSolicitud])).rows[0];
  assert.equal(orden.estado, 'ASIGNADA');
  assert.equal((await api(server.url, 'PATCH', `/api/admin/incidencias/${idInc}`, { token: admin.token, body: { prioridad: 'BAJA' } })).status, 409);
});

test('la configuración del panel cambia el retiro mínimo, la comisión y el modo mantenimiento de la app', async () => {
  const admin = await as(3);
  const tecnico = await as(2);
  await walletFor(tecnico.id, '1000.00');

  const fuera = await api(server.url, 'PUT', '/api/admin/configuracion', { token: admin.token, body: { comision_porcentaje: 90 } });
  assert.equal(fuera.status, 400);

  const put = await api(server.url, 'PUT', '/api/admin/configuracion', {
    token: admin.token, body: { monto_minimo_retiro: 300, comision_porcentaje: 15 },
  });
  assert.equal(put.status, 200);
  assert.equal((await api(server.url, 'GET', '/api/billetera', { token: tecnico.token })).body.minimo_retiro, '300.00');
  const bajo = await api(server.url, 'POST', '/api/billetera/retiro', { token: tecnico.token, body: { monto: '200.00' }, headers: idem() });
  assert.equal(bajo.status, 400);
  assert.equal(bajo.body.code, 'MIN_WITHDRAWAL');
  const liq = (await getPool().query('SELECT * FROM cs_liquidacion(1160)')).rows[0];
  assert.equal(liq.comision, '174.00');

  await api(server.url, 'PUT', '/api/admin/configuracion', {
    token: admin.token, body: { modo_mantenimiento: true, mensaje_mantenimiento: 'Volvemos a las 6 pm.' },
  });
  const app = await api(server.url, 'GET', '/api/billetera', { token: tecnico.token });
  assert.equal(app.status, 503);
  assert.equal(app.body.error, 'Volvemos a las 6 pm.');
  const panel = await api(server.url, 'GET', '/api/admin/configuracion', { token: admin.token });
  assert.equal(panel.status, 200, 'el panel sigue funcionando para poder apagarlo');
  assert.equal(panel.body.configuracion.modo_mantenimiento, true);
});
