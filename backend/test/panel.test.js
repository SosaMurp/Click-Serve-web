const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');
const { outbox } = require('../src/lib/mailer');

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
  // El código viaja por correo (outbox en pruebas); en la base solo queda su HMAC.
  const correo = outbox.filter((m) => m.to === admin.email).at(-1);
  const { rows } = await getPool().query(
    "SELECT token FROM tokens_temporales WHERE id_usuario = $1 AND tipo_accion = 'login_admin' AND estado_uso = 'sin usar'",
    [admin.id]
  );
  assert.notEqual(rows[0].token, correo.code, 'el código no debe guardarse en claro');
  assert.equal(rows[0].token.length, 64);
  const paso2 = await api(server.url, 'POST', '/api/verify-login-admin', { body: { email: admin.email, token: correo.code } });
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
  assert.equal(mes.body.puntos.length, 30); // sin rango: últimos 30 días
  assert.equal(mes.body.total_completados, 1);

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

test('bandeja de soporte: el asesor ve el caso de la app, responde, lo clasifica y lo cierra', async () => {
  const admin = await as(3);
  const cliente = await as(1);
  const nuevo = await api(server.url, 'POST', '/api/soporte/tickets', {
    token: cliente.token, body: { asunto: 'No me llegó el reembolso', categoria: 'PAGOS', mensaje: 'Cancelé y no veo el reembolso.' },
  });
  assert.equal(nuevo.status, 201);
  const id = nuevo.body.ticket.id_ticket;

  const bandeja = await api(server.url, 'GET', '/api/admin/soporte/tickets?estado=ACTIVOS', { token: admin.token });
  assert.equal(bandeja.status, 200);
  assert.ok(bandeja.body.tickets.some((t) => t.id_ticket === id));
  assert.equal((await api(server.url, 'GET', '/api/admin/soporte/tickets', { token: cliente.token })).status, 403);

  const resp = await api(server.url, 'POST', `/api/admin/soporte/tickets/${id}/mensajes`, { token: admin.token, body: { mensaje: 'Ya lo revisé, llega en 3 días hábiles.' } });
  assert.equal(resp.status, 201);
  const hilo = await api(server.url, 'GET', `/api/soporte/tickets/${id}/mensajes`, { token: cliente.token });
  assert.equal(hilo.body.mensajes.at(-1).mensaje, 'Ya lo revisé, llega en 3 días hábiles.');
  assert.equal(hilo.body.ticket.estado, 'EN_ATENCION');

  const cerrar = await api(server.url, 'PATCH', `/api/admin/soporte/tickets/${id}`, { token: admin.token, body: { estado: 'CERRADO', prioridad: 'BAJA' } });
  assert.equal(cerrar.status, 200);
  assert.equal(cerrar.body.ticket.estado, 'CERRADO');
  assert.equal((await api(server.url, 'POST', `/api/admin/soporte/tickets/${id}/mensajes`, { token: admin.token, body: { mensaje: 'otra' } })).status, 409);
  const detalle = await api(server.url, 'GET', `/api/admin/soporte/tickets/${id}/mensajes`, { token: admin.token });
  assert.equal(detalle.body.ticket.nombre, 'Cliente');
  assert.ok(detalle.body.mensajes.length >= 3);
});

test('reportes: CSV por partes, Excel con una hoja por dimensión y expediente de incidencia', async () => {
  const admin = await as(3);
  const cliente = await as(1);
  const tecnico = await as(2);
  const id = await solicitud(cliente.id, tecnico.id, 'ASIGNADA');
  await getPool().query("UPDATE usuarios SET nombre = '=HYPERLINK(1)' WHERE id_usuario = $1", [cliente.id]);

  const csv = await fetch(`${server.url}/api/admin/reportes?alcance=7d&dimensiones=servicios,identidad&formato=csv`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const texto = await csv.text();
  assert.ok(texto.includes('Servicios') && texto.includes('Auditoría de identidad'));
  assert.ok(texto.includes("'=HYPERLINK(1)"), 'el texto que empieza con = se neutraliza');

  const xlsx = await fetch(`${server.url}/api/admin/reportes?alcance=month&dimensiones=servicios,finanzas&formato=xlsx`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(xlsx.status, 200);
  const buf = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(buf.slice(0, 2).toString(), 'PK', 'es un archivo .xlsx (zip)');
  const ExcelJS = require('exceljs');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buf);
  assert.deepEqual(libro.worksheets.map((w) => w.name), ['Servicios', 'Cobros a clientes', 'Billeteras de técnicos']);
  assert.ok(libro.worksheets[0].rowCount >= 2, 'encabezado y al menos un servicio');

  const malo = await api(server.url, 'GET', '/api/admin/reportes?alcance=custom&desde=2026-01-10&hasta=2026-01-01', { token: admin.token });
  assert.equal(malo.status, 400);
  assert.equal((await api(server.url, 'GET', '/api/admin/reportes', { token: cliente.token })).status, 403);

  const rep = await api(server.url, 'POST', `/api/solicitudes/${id}/incidencias`, { token: cliente.token, body: { tipo: 'OTRO', descripcion: 'Necesito que revisen el caso.' } });
  const exp = await api(server.url, 'GET', `/api/admin/incidencias/${rep.body.incidencia.id_incidencia}/expediente`, { token: admin.token });
  assert.equal(exp.status, 200);
  assert.equal(exp.body.incidencia.folio, rep.body.incidencia.folio);
  assert.ok(Array.isArray(exp.body.evidencias));
});

test('el detalle del servicio en el panel trae tareas, evidencias, calificación, pago e incidencias reales', async () => {
  const admin = await as(3);
  const cliente = await createUser({ rol: 1, nombre: 'Lucia' });
  const tecnico = await createUser({ rol: 2, nombre: 'Mario' });
  const id = await solicitud(cliente.id, tecnico.id, 'EN_PROCESO');
  await getPool().query("INSERT INTO tareas_servicio (id_solicitud, descripcion, origen, orden, completada) VALUES ($1, 'Cerrar la llave de paso', 'PLANTILLA', 1, true)", [id]);

  const res = await api(server.url, 'GET', `/api/admin/solicitudes/${id}`, { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.cliente_nombre, 'Lucia');
  assert.equal(res.body.tecnico_nombre, 'Mario');
  assert.equal(res.body.descripcion, 'Fuga en el baño');
  assert.equal(res.body.tareas.length, 1);
  assert.equal(res.body.tareas[0].completada, true);
  assert.deepEqual(res.body.evidencias, []);
  assert.equal(res.body.calificacion, null);
  assert.equal(res.body.pago, null);
  assert.deepEqual(res.body.incidencias, []);
});

test('el tablero responde aunque no haya pagos (tabla pagos con el esquema de la app)', async () => {
  const admin = await as(3);
  const res = await api(server.url, 'GET', '/api/admin/dashboard/stats', { token: admin.token });
  assert.equal(res.status, 200);
  assert.ok('ingresos_hoy' in res.body);
});

test('un técnico en revisión no ve solicitudes pendientes ajenas; uno aprobado sí', async () => {
  const cliente = await createUser({ rol: 1 });
  const id = await solicitud(cliente.id, null, 'PENDIENTE');
  const pendiente = await as(2, { aprobado: false });
  const aprobado = await as(2);
  assert.equal((await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: pendiente.token })).status, 404);
  assert.equal((await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: aprobado.token })).status, 200);
});

test('los cuerpos JSON de más de 1 MB se rechazan fuera del registro', async () => {
  const admin = await as(3);
  const res = await api(server.url, 'POST', '/api/admin/comunicados', { token: admin.token, body: { id_usuario: admin.id, mensaje: 'x'.repeat(1_200_000) } });
  assert.equal(res.status, 413);
  assert.equal(res.body.code, 'PAYLOAD_TOO_LARGE');
});

test('a un técnico en revisión la lista de nuevas le sale vacía', async () => {
  const cliente = await createUser({ rol: 1 });
  await solicitud(cliente.id, null, 'PENDIENTE');
  const pendiente = await as(2, { aprobado: false });
  const res = await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: pendiente.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.solicitudes.length, 0);
  assert.equal(res.body.contadores.nuevas, 0);
});

test('el dashboard filtra por el rango de fechas que elige el administrador', async () => {
  const admin = await as(3);
  const hoy = require('../src/lib/dates').todayMx();
  const q = (ruta, qs) => api(server.url, 'GET', `/api/admin/dashboard/${ruta}${qs}`, { token: admin.token });

  // Rango de un solo día = hoy: una sola barra en la gráfica
  const dia = await q('servicios-mes', `?desde=${hoy}&hasta=${hoy}`);
  assert.equal(dia.status, 200);
  assert.equal(dia.body.puntos.length, 1);
  assert.equal(dia.body.puntos[0].fecha, hoy);

  // Un rango en el pasado no incluye lo creado hoy
  const pasado = await q('servicios-mes', '?desde=2020-01-01&hasta=2020-01-31');
  assert.equal(pasado.body.puntos.length, 31);
  assert.equal(pasado.body.total_completados, 0);
  const statsPasado = await q('stats', '?desde=2020-01-01&hasta=2020-01-31');
  assert.equal(statsPasado.body.servicios_completados_periodo, 0);
  assert.equal(Number(statsPasado.body.ingresos_periodo), 0);
  assert.deepEqual(statsPasado.body.periodo, { desde: '2020-01-01', hasta: '2020-01-31' });
  assert.deepEqual((await q('especialidades', '?desde=2020-01-01&hasta=2020-01-31')).body, []);
  assert.deepEqual((await q('tecnicos-destacados', '?desde=2020-01-01&hasta=2020-01-31')).body.tecnicos, []);
  assert.deepEqual((await q('actividad', '?desde=2020-01-01&hasta=2020-01-31')).body.items, []);

  // Las filas de actividad traen tipo e id para poder abrirlas
  const feed = await q('actividad', '');
  assert.ok(feed.body.items.every((i) => ['servicio', 'tecnico', 'alerta'].includes(i.tipo) && i.id != null));
});

test('el dashboard rechaza rangos de fechas inválidos', async () => {
  const admin = await as(3);
  const q = (qs) => api(server.url, 'GET', `/api/admin/dashboard/stats${qs}`, { token: admin.token });
  assert.equal((await q('?desde=2026-02-30&hasta=2026-03-01')).status, 400);
  assert.equal((await q('?desde=ayer&hasta=hoy')).status, 400);
  assert.equal((await q('?desde=2026-03-10&hasta=2026-03-01')).status, 400);
  assert.equal((await q('?desde=2024-01-01&hasta=2026-01-01')).status, 400);
  assert.equal((await q('?desde=2026-03-01')).status, 400);
});
