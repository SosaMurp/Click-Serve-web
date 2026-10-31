const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, getPool, closePool } = require('./helpers');
const { invalidateConfig } = require('../src/services/config');

// Liquidación de conflictos desde el panel (RF-82, RF-83).
let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });
test.afterEach(async () => {
  await getPool().query('UPDATE configuracion_plataforma SET multa_operativa = 100 WHERE id = 1');
  invalidateConfig();
});

async function as(rol, opts = {}) {
  const u = await createUser({ rol, ...opts });
  return { ...u, token: await login(server.url, u) };
}

let seq = 0;
// Orden cobrada con una incidencia abierta y el técnico con saldo en su billetera.
async function caso({ pagado = 500, saldo = 1000, conTecnico = true, conPago = true } = {}) {
  const pool = getPool();
  const admin = await as(3);
  const cliente = await as(1);
  const tecnico = await as(2);
  const n = ++seq;
  const sol = (await pool.query(
    `INSERT INTO solicitudes_servicio (folio, id_usuario, id_tecnico, descripcion, direccion, estado, estado_pago)
     VALUES ($1, $2, $3, 'Instalación eléctrica', 'Calle 1', 'FINALIZADA', $4) RETURNING id_solicitud`,
    [`SRV-LIQ-${n}`, cliente.id, conTecnico ? tecnico.id : null, conPago ? 'PAGADO' : 'PENDIENTE']
  )).rows[0].id_solicitud;
  if (conPago) {
    await pool.query(
      `INSERT INTO pagos (id_solicitud, id_cliente, monto, estado, modo, referencia) VALUES ($1, $2, $3, 'PAGADO', 'SANDBOX', $4)`,
      [sol, cliente.id, pagado, `sbx_liq_${n}`]
    );
  }
  await pool.query(
    `INSERT INTO billetera_tecnico (id_usuario, saldo_actual) VALUES ($1, $2)
     ON CONFLICT (id_usuario) DO UPDATE SET saldo_actual = EXCLUDED.saldo_actual`,
    [tecnico.id, saldo]
  );
  const inc = (await pool.query(
    `INSERT INTO incidencias (folio, id_solicitud, id_usuario, tipo, descripcion, prioridad, estado_previo)
     VALUES ($1, $2, $3, 'MALA_CALIDAD', 'El trabajo quedó mal hecho.', 'MEDIA', 'FINALIZADA') RETURNING id_incidencia`,
    [`INC-LIQ-${n}`, sol, cliente.id]
  )).rows[0].id_incidencia;
  return { admin, cliente, tecnico, sol, inc };
}

const saldoDe = async (idUsuario) =>
  Number((await getPool().query('SELECT saldo_actual FROM billetera_tecnico WHERE id_usuario = $1', [idUsuario])).rows[0].saldo_actual);
const liquidar = (c, body) => api(server.url, 'POST', `/api/admin/incidencias/${c.inc}/liquidar`, { token: c.admin.token, body });

test('solo un administrador consulta o liquida un caso', async () => {
  const c = await caso();
  assert.equal((await api(server.url, 'GET', `/api/admin/incidencias/${c.inc}/liquidacion`, { token: c.cliente.token })).status, 403);
  assert.equal((await api(server.url, 'POST', `/api/admin/incidencias/${c.inc}/liquidar`, { token: c.tecnico.token, body: { multa: 100 } })).status, 403);
  assert.equal((await api(server.url, 'POST', `/api/admin/incidencias/${c.inc}/liquidar`, { body: { multa: 100 } })).status, 401);
});

test('el panel ve lo cobrado, lo reembolsable, el saldo del técnico y la multa sugerida', async () => {
  const c = await caso({ pagado: 500, saldo: 300 });
  await api(server.url, 'PUT', '/api/admin/configuracion', { token: c.admin.token, body: { multaOperativa: 150 } });
  const res = await api(server.url, 'GET', `/api/admin/incidencias/${c.inc}/liquidacion`, { token: c.admin.token });
  assert.equal(res.status, 200);
  const l = res.body.liquidacion;
  assert.equal(l.liquidada, false);
  assert.equal(l.pagado, 500);
  assert.equal(l.reembolsable, 500);
  assert.equal(l.saldo_tecnico, 300);
  assert.equal(l.multa_sugerida, 150);
});

test('devolver al cliente y multar al técnico asienta los movimientos y ajusta su billetera', async () => {
  const c = await caso({ pagado: 500, saldo: 1000 });
  const res = await liquidar(c, { devolucion: 150, multa: 100, descontar_devolucion: true, notas: 'Trabajo deficiente' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.liquidacion.cargo_tecnico, 250);
  assert.equal(res.body.liquidacion.saldo_tecnico, 750);
  assert.equal(await saldoDe(c.tecnico.id), 750);

  const trx = (await getPool().query(
    `SELECT t.tipo, t.concepto, t.monto FROM transacciones t JOIN billetera_tecnico b ON b.id_billetera = t.id_billetera
     WHERE b.id_usuario = $1 ORDER BY t.id_transaccion`, [c.tecnico.id]
  )).rows;
  assert.deepEqual(trx.map((t) => [t.tipo, t.concepto, Number(t.monto)]), [['AJUSTE', 'MULTA', 100], ['AJUSTE', 'REEMBOLSO', 150]]);

  const pago = (await getPool().query('SELECT monto_reembolsado, estado FROM pagos WHERE id_solicitud = $1', [c.sol])).rows[0];
  assert.equal(Number(pago.monto_reembolsado), 150);
  assert.equal(pago.estado, 'PAGADO', 'un reembolso parcial no marca el cobro como reembolsado');

  const inc = (await getPool().query('SELECT multa, monto_reembolso, fecha_liquidacion, id_admin, notas_admin FROM incidencias WHERE id_incidencia = $1', [c.inc])).rows[0];
  assert.equal(Number(inc.multa), 100);
  assert.equal(Number(inc.monto_reembolso), 150);
  assert.ok(inc.fecha_liquidacion);
  assert.equal(inc.id_admin, c.admin.id);
  assert.equal(inc.notas_admin, 'Trabajo deficiente');

  // El técnico los ve en su billetera de la app.
  const movs = await api(server.url, 'GET', '/api/billetera/movimientos', { token: c.tecnico.token });
  assert.ok(movs.body.movimientos.some((m) => m.tipo === 'AJUSTE' && m.concepto === 'MULTA'));
});

test('la devolución sin descontarla al técnico no toca su billetera', async () => {
  const c = await caso({ pagado: 500, saldo: 1000 });
  const res = await liquidar(c, { devolucion: 200 });
  assert.equal(res.status, 200);
  assert.equal(res.body.liquidacion.cargo_tecnico, 0);
  assert.equal(await saldoDe(c.tecnico.id), 1000);
  const pago = (await getPool().query('SELECT monto_reembolsado FROM pagos WHERE id_solicitud = $1', [c.sol])).rows[0];
  assert.equal(Number(pago.monto_reembolsado), 200);
});

test('devolver todo el cobro marca el pago como reembolsado', async () => {
  const c = await caso({ pagado: 500 });
  assert.equal((await liquidar(c, { devolucion: 500 })).status, 200);
  assert.equal((await getPool().query('SELECT estado FROM pagos WHERE id_solicitud = $1', [c.sol])).rows[0].estado, 'REEMBOLSADO');
});

test('un caso se liquida una sola vez', async () => {
  const c = await caso();
  assert.equal((await liquidar(c, { multa: 100 })).status, 200);
  const otra = await liquidar(c, { multa: 100 });
  assert.equal(otra.status, 409);
  assert.equal(otra.body.code, 'ALREADY_SETTLED');
  assert.equal(await saldoDe(c.tecnico.id), 900, 'la segunda multa no se aplicó');
});

test('no se devuelve más de lo cobrado y un rechazo no cambia nada', async () => {
  const c = await caso({ pagado: 500, saldo: 1000 });
  const res = await liquidar(c, { devolucion: 600, multa: 100, descontar_devolucion: true });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'REFUND_EXCEEDS_PAYMENT');
  assert.equal(await saldoDe(c.tecnico.id), 1000);
  const inc = (await getPool().query('SELECT fecha_liquidacion FROM incidencias WHERE id_incidencia = $1', [c.inc])).rows[0];
  assert.equal(inc.fecha_liquidacion, null);
});

test('valida montos: vacío, negativos y multa fuera de rango', async () => {
  const c = await caso();
  assert.equal((await liquidar(c, {})).status, 400);
  assert.equal((await liquidar(c, { devolucion: -5 })).status, 400);
  assert.equal((await liquidar(c, { multa: 'abc' })).status, 400);
  assert.equal((await liquidar(c, { multa: 10001 })).status, 400);
});

test('sin cobro no hay nada que devolver y sin técnico no hay a quién multar', async () => {
  const sinPago = await caso({ conPago: false });
  const a = await liquidar(sinPago, { devolucion: 50 });
  assert.equal(a.status, 409);
  assert.equal(a.body.code, 'NO_PAYMENT');

  const sinTecnico = await caso({ conTecnico: false });
  const b = await liquidar(sinTecnico, { multa: 100 });
  assert.equal(b.status, 409);
  assert.equal(b.body.code, 'NO_TECHNICIAN');
});

test('el saldo puede quedar negativo y se avisa', async () => {
  const c = await caso({ saldo: 50 });
  const res = await liquidar(c, { multa: 100 });
  assert.equal(res.status, 200);
  assert.equal(res.body.liquidacion.saldo_tecnico, -50);
  assert.equal(res.body.liquidacion.saldo_negativo, true);
});

test('la lista de incidencias del panel muestra lo liquidado', async () => {
  const c = await caso();
  await liquidar(c, { devolucion: 100, multa: 100 });
  const lista = await api(server.url, 'GET', '/api/admin/incidencias', { token: c.admin.token });
  const fila = lista.body.incidencias.find((i) => i.id_incidencia === c.inc);
  assert.equal(Number(fila.multa), 100);
  assert.equal(Number(fila.monto_reembolso), 100);
  assert.ok(fila.fecha_liquidacion);
});
