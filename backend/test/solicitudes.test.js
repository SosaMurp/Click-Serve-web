const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, idem, getPool, closePool, simularPrecioBasePagado } = require('./helpers');

let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function cliente(opts = {}) {
  const u = await createUser({ rol: 1, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function tecnico(opts = {}) {
  const u = await createUser({ rol: 2, latitud: 17.96, longitud: -102.2, disponible: true, ...opts });
  return { ...u, token: await login(server.url, u) };
}

async function crearSolicitud(token, body = {}, headers = idem()) {
  return api(server.url, 'POST', '/api/solicitudes', {
    token,
    headers,
    body: {
      categoria: 'ELECTRICIDAD',
      descripcion: 'El contacto de la cocina hace chispa al conectar aparatos.',
      direccion: 'Av. Lázaro Cárdenas 120, Centro, Lázaro Cárdenas',
      fecha_preferida: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      hora_preferida: '10:30',
      latitud: 17.958,
      longitud: -102.199,
      ...body,
    },
  });
}

async function tarjeta(clienteId, token = 'tok_test_visa_4242', ultimos = '4242') {
  const { rows } = await getPool().query(
    `INSERT INTO metodos_pago (id_usuario, titular, ultimos_4, expiracion, token, marca, predeterminada)
     VALUES ($1, 'Cliente Prueba', $2, '12/30', $3, 'VISA', true) RETURNING id_metodo`,
    [clienteId, ultimos, token]
  );
  return rows[0].id_metodo;
}

// Precio base: el técnico cobra $1,160 por Electricidad (se fija directo en la base, fuera del rango, para
// conservar los montos de estas pruebas). Al aceptar, la app crea la cotización base y la orden espera el pago
// (dirección y chat ocultos).
async function hastaCotizada() {
  const c = await cliente();
  const t = await tecnico();
  await getPool().query(
    "INSERT INTO especialidades_tecnico (id_usuario, nombre, categoria, estado, activa, precio_base) VALUES ($1, 'Electricidad', 'ELECTRICIDAD', 'VERIFICADA', true, 1160)",
    [t.id]
  );
  const s = (await crearSolicitud(c.token)).body.solicitud;
  const id = s.id_solicitud;
  const acepta = await api(server.url, 'POST', `/api/solicitudes/${id}/aceptar`, { token: t.token });
  assert.equal(acepta.status, 200);
  assert.equal(acepta.body.solicitud.estado, 'ESPERANDO_APROBACION');
  assert.equal(acepta.body.solicitud.precio_base, '1160.00');
  return { c, t, id };
}

// Paga la cotización en custodia, el técnico va al domicilio e inicia el trabajo (EN_PROCESO).
async function hastaEnProceso() {
  const { c, t, id } = await hastaCotizada();
  const metodo = await tarjeta(c.id);
  const pago = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(pago.status, 200);
  assert.equal(pago.body.solicitud.estado, 'ASIGNADA');
  for (const estado of ['EN_CAMINO', 'EN_SITIO', 'EN_PROCESO']) {
    assert.equal((await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado } })).status, 200, estado);
  }
  return { c, t, id, metodo };
}

// Orden aprobada con el flujo anterior (sin custodia): al confirmar se cobra el total completo.
async function hastaEnProcesoSinCustodia() {
  const { c, t, id } = await hastaCotizada();
  await getPool().query("UPDATE cotizaciones_servicio SET estado = 'ACEPTADA' WHERE id_solicitud = $1 AND estado = 'ENVIADA'", [id]);
  await getPool().query(
    "UPDATE solicitudes_servicio SET estado = 'EN_PROCESO', monto_total = 1160, direccion_liberada = true, fecha_llegada = NOW() WHERE id_solicitud = $1",
    [id]
  );
  return { c, t, id };
}

async function subirEvidencia(token, id) {
  const form = new FormData();
  form.append('fotos', new Blob([PNG], { type: 'image/png' }), 'despues.png');
  form.append('tipo', 'DESPUES');
  return api(server.url, 'POST', `/api/solicitudes/${id}/evidencias`, { token, form });
}

test('una cotización de la versión anterior (sin desglose) no se puede pagar y no cobra', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  // Así dejaba la orden la ruta anterior: solo el estado y el monto, sin fila en cotizaciones_servicio.
  await getPool().query('DELETE FROM conceptos_cotizacion WHERE id_solicitud = $1', [s.id_solicitud]);
  await getPool().query('DELETE FROM cotizaciones_servicio WHERE id_solicitud = $1', [s.id_solicitud]);
  await getPool().query("UPDATE solicitudes_servicio SET estado = 'ESPERANDO_APROBACION', monto_cotizacion = 500 WHERE id_solicitud = $1", [s.id_solicitud]);
  const res = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'QUOTE_OUTDATED');
  const row = await getPool().query('SELECT estado, estado_pago FROM solicitudes_servicio WHERE id_solicitud = $1', [s.id_solicitud]);
  assert.deepEqual(row.rows[0], { estado: 'ESPERANDO_APROBACION', estado_pago: 'PENDIENTE' });
  const custodias = await getPool().query('SELECT COUNT(*)::int AS n FROM custodias WHERE id_solicitud = $1', [s.id_solicitud]);
  assert.equal(custodias.rows[0].n, 0);
});

test('custodia: sin pagar el técnico no ve la dirección ni puede salir; al pagar se libera', async () => {
  const { c, t, id } = await hastaCotizada();
  const oculto = await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: t.token });
  assert.equal(oculto.body.solicitud.direccion, undefined);
  assert.equal(oculto.body.solicitud.cliente_telefono, undefined);
  assert.equal(oculto.body.solicitud.direccion_liberada, false);
  assert.ok(oculto.body.solicitud.zona);
  const sale = await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_CAMINO' } });
  assert.equal(sale.status, 409);
  assert.equal(sale.body.code, 'CUSTODY_REQUIRED');
  // Aprobar sin pagar ya no existe, y el precio base no se rechaza (se paga o se cancela).
  const acepta = await api(server.url, 'PATCH', `/api/solicitudes/${id}/responder-cotizacion`, { token: c.token, body: { respuesta: 'ACEPTAR' } });
  assert.equal(acepta.body.code, 'CUSTODY_REQUIRED');
  const rechaza = await api(server.url, 'PATCH', `/api/solicitudes/${id}/responder-cotizacion`, { token: c.token, body: { respuesta: 'RECHAZAR' } });
  assert.equal(rechaza.body.code, 'BASE_PRICE_REQUIRED');
  // El chat se abre solo con el precio base pagado, y el técnico no cotiza antes.
  const chat = await api(server.url, 'GET', `/api/solicitudes/${id}/chat`, { token: c.token });
  assert.equal(chat.body.bloqueado, true);
  const escribe = await api(server.url, 'POST', `/api/solicitudes/${id}/chat`, { token: c.token, body: { mensaje: 'Hola' } });
  assert.equal(escribe.body.code, 'CHAT_LOCKED');
  const cotizaAntes = await api(server.url, 'POST', `/api/solicitudes/${id}/cotizar`, {
    token: t.token, body: { conceptos: [{ tipo: 'MANO_OBRA', descripcion: 'Otra', monto: '50.00' }] },
  });
  assert.equal(cotizaAntes.body.code, 'BASE_PRICE_REQUIRED');

  const headers = idem();
  const body = { id_metodo: await tarjeta(c.id) };
  const a = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers, body });
  const b = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers, body });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.solicitud.estado, 'ASIGNADA');
  assert.equal(a.body.solicitud.estado_pago, 'EN_CUSTODIA');
  assert.equal(a.body.custodia.monto, '1160.0000');
  const custodias = await getPool().query("SELECT COUNT(*)::int AS n FROM custodias WHERE id_solicitud = $1 AND estado = 'RETENIDO'", [id]);
  assert.equal(custodias.rows[0].n, 1);

  const visible = await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: t.token });
  assert.match(visible.body.solicitud.direccion, /Lázaro Cárdenas 120/);
  // El teléfono nunca se comparte, ni con la custodia pagada: todo va por el chat de la app.
  assert.equal(visible.body.solicitud.cliente_telefono, undefined);
  assert.equal((await api(server.url, 'GET', `/api/solicitudes/${id}/chat`, { token: c.token })).body.bloqueado, undefined);
  // Pagado el precio base, el adicional solo se cotiza en el domicilio; y no inicia el trabajo sin estar en el sitio.
  const recotiza = await api(server.url, 'POST', `/api/solicitudes/${id}/cotizar`, {
    token: t.token, body: { conceptos: [{ tipo: 'MANO_OBRA', descripcion: 'Otra', monto: '50.00' }] },
  });
  assert.equal(recotiza.body.code, 'INVALID_STATE');
  assert.equal((await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_PROCESO' } })).status, 409);
});

test('adicional: en el domicilio el técnico cotiza el trabajo completo y el cliente paga solo la diferencia', async () => {
  const { c, t, id } = await hastaCotizada();
  const metodo = await tarjeta(c.id);
  assert.equal((await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } })).status, 200);
  for (const estado of ['EN_CAMINO', 'EN_SITIO']) {
    assert.equal((await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado } })).status, 200, estado);
  }
  // Menos de lo ya pagado no se acepta.
  const menor = await api(server.url, 'POST', `/api/solicitudes/${id}/cotizar`, {
    token: t.token, body: { conceptos: [{ tipo: 'MANO_OBRA', descripcion: 'Solo revisión', monto: '100.00' }] },
  });
  assert.equal(menor.status, 400);
  const adicional = await api(server.url, 'POST', `/api/solicitudes/${id}/cotizar`, {
    token: t.token,
    body: { conceptos: [
      { tipo: 'MANO_OBRA', descripcion: 'Precio base · Electricidad', monto: '1160.00' },
      { tipo: 'MATERIAL', descripcion: 'Pastilla termomagnética 20A', monto: '300.00' },
    ] },
  });
  assert.equal(adicional.status, 200);
  assert.equal(adicional.body.solicitud.estado, 'ESPERANDO_APROBACION');
  const paga = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(paga.status, 200);
  assert.equal(paga.body.cobrado, '300.00');
  assert.equal(paga.body.solicitud.estado, 'EN_PROCESO');
  assert.equal(paga.body.custodia.monto, '1460.0000');
  const k = await getPool().query("SELECT COUNT(*)::int AS n, MAX(monto) AS monto FROM custodias WHERE id_solicitud = $1 AND estado = 'RETENIDO'", [id]);
  assert.deepEqual(k.rows[0], { n: 1, monto: '1460.0000' });
});

test('adicional rechazado: vuelve al domicilio con el precio base pagado', async () => {
  const { c, t, id } = await hastaCotizada();
  await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_SITIO' } });
  await api(server.url, 'POST', `/api/solicitudes/${id}/cotizar`, {
    token: t.token, body: { conceptos: [{ tipo: 'MANO_OBRA', descripcion: 'Trabajo completo', monto: '1500.00' }] },
  });
  const sinMotivo = await api(server.url, 'PATCH', `/api/solicitudes/${id}/responder-cotizacion`, { token: c.token, body: { respuesta: 'RECHAZAR' } });
  assert.equal(sinMotivo.status, 400, 'el cliente debe decir por qué rechaza');
  const otroSinTexto = await api(server.url, 'PATCH', `/api/solicitudes/${id}/responder-cotizacion`, { token: c.token, body: { respuesta: 'RECHAZAR', motivo: 'OTRO' } });
  assert.equal(otroSinTexto.body.field, 'comentario');
  const rechazo = await api(server.url, 'PATCH', `/api/solicitudes/${id}/responder-cotizacion`, {
    token: c.token, body: { respuesta: 'RECHAZAR', motivo: 'PRECIO_ALTO', comentario: 'Me cotizaron menos en otro lado' },
  });
  assert.equal(rechazo.status, 200);
  assert.equal(rechazo.body.solicitud.estado, 'EN_SITIO');
  // El técnico ve el motivo y los conceptos del adicional rechazado para mandar otra cotización.
  const tec = await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: t.token });
  assert.equal(tec.body.solicitud.ultimo_rechazo.motivo, 'PRECIO_ALTO');
  assert.equal(tec.body.solicitud.ultimo_rechazo.comentario, 'Me cotizaron menos en otro lado');
  assert.equal(tec.body.solicitud.ultimo_rechazo.conceptos[0].monto, '1500.0000');
  const otra = await api(server.url, 'POST', `/api/solicitudes/${id}/cotizar`, {
    token: t.token, body: { conceptos: [{ tipo: 'MANO_OBRA', descripcion: 'Trabajo completo con descuento', monto: '1300.00' }] },
  });
  assert.equal(otra.status, 200, 'puede mandar otra cotización');
  assert.equal((await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: t.token })).body.solicitud.ultimo_rechazo, null);
  await api(server.url, 'PATCH', `/api/solicitudes/${id}/responder-cotizacion`, { token: c.token, body: { respuesta: 'RECHAZAR', motivo: 'NO_LO_DESEA' } });
  assert.equal(rechazo.body.solicitud.custodia.monto, '1160.0000');
  assert.equal((await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_PROCESO' } })).status, 200);
});

test('precio base sin pagar a tiempo: la orden se cancela sola y el técnico queda libre', async () => {
  const { vencerPreciosBase } = require('../src/services/precioBase');
  const { c, t, id } = await hastaCotizada();
  const det = await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: c.token });
  assert.ok(det.body.solicitud.pago_vence, 'el cliente ve hasta cuándo puede pagar');
  await vencerPreciosBase();
  assert.equal((await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: c.token })).body.solicitud.estado, 'ESPERANDO_APROBACION', 'aún no vence');
  await getPool().query("UPDATE solicitudes_servicio SET fecha_asignacion = NOW() - INTERVAL '3 hours' WHERE id_solicitud = $1", [id]);
  assert.ok((await vencerPreciosBase()) >= 1);
  const row = (await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: t.token })).body.solicitud;
  assert.equal(row.estado, 'CANCELADA');
  assert.equal(row.cancelado_por, 'SISTEMA');
  const pagos = await getPool().query('SELECT COUNT(*)::int AS n FROM pagos WHERE id_solicitud = $1', [id]);
  assert.equal(pagos.rows[0].n, 0);
});

test('cancelar con el técnico en camino cobra la visita de la custodia y devuelve el resto', async () => {
  const { c, t, id } = await hastaCotizada();
  await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_CAMINO' } });
  const det = await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: c.token });
  assert.equal(det.body.solicitud.cargo_si_cancela, '580.00', 'la mitad del precio base');
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: c.token, body: { motivo: 'Ya no lo necesito' } });
  assert.equal(res.status, 200);
  assert.match(res.body.mensaje, /\$580\.00 por la visita/);
  assert.match(res.body.mensaje, /devolveremos \$580\.00/);
  assert.equal(res.body.solicitud.estado_pago, 'REEMBOLSO_PENDIENTE');
  const k = await getPool().query('SELECT estado, monto, cargo_cancelacion FROM custodias WHERE id_solicitud = $1', [id]);
  assert.deepEqual(k.rows[0], { estado: 'REEMBOLSO_PENDIENTE', monto: '580.0000', cargo_cancelacion: '580.0000' });
  const pago = await getPool().query('SELECT monto FROM pagos WHERE id_solicitud = $1', [id]);
  assert.equal(pago.rows[0].monto, '580.0000');
  const saldo = await getPool().query('SELECT saldo_actual FROM billetera_tecnico WHERE id_usuario = $1', [t.id]);
  assert.ok(Number(saldo.rows[0].saldo_actual) > 0, 'el técnico recibe la visita menos la comisión');
});

test('si el técnico va tarde, cancelar en camino no cobra la visita', async () => {
  const { c, t, id } = await hastaCotizada();
  await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_CAMINO' } });
  await getPool().query("UPDATE solicitudes_servicio SET fecha_preferida = CURRENT_DATE - 1 WHERE id_solicitud = $1", [id]);
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: c.token, body: { motivo: 'Nunca llegó' } });
  assert.equal(res.status, 200);
  assert.match(res.body.mensaje, /devolveremos \$1160\.00/);
  const pagos = await getPool().query('SELECT COUNT(*)::int AS n FROM pagos WHERE id_solicitud = $1', [id]);
  assert.equal(pagos.rows[0].n, 0);
});

test('precio base del técnico: solo dentro del rango de la categoría', async () => {
  const t = await tecnico();
  const esp = await api(server.url, 'POST', '/api/tecnico/especialidades', { token: t.token, body: { categoria: 'PLOMERIA' } });
  const idEsp = esp.body.especialidad.id_especialidad;
  for (const precio of ['50', '5000', 'abc']) {
    const res = await api(server.url, 'PATCH', `/api/tecnico/especialidades/${idEsp}/precio`, { token: t.token, body: { precio_base: precio } });
    assert.equal(res.status, 400, `precio ${precio}`);
  }
  const ok = await api(server.url, 'PATCH', `/api/tecnico/especialidades/${idEsp}/precio`, { token: t.token, body: { precio_base: '350' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.especialidades[0].precio_base, '350.00');
});

test('custodia: tarjeta declinada no libera la dirección y la orden sigue esperando aprobación', async () => {
  const { c, t, id } = await hastaCotizada();
  const mala = await tarjeta(c.id, 'tok_test_card_declined', '0002');
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: mala } });
  assert.equal(res.status, 402);
  const row = await getPool().query('SELECT estado, estado_pago, direccion_liberada FROM solicitudes_servicio WHERE id_solicitud = $1', [id]);
  assert.deepEqual(row.rows[0], { estado: 'ESPERANDO_APROBACION', estado_pago: 'PENDIENTE', direccion_liberada: false });
  const det = await api(server.url, 'GET', `/api/solicitudes/${id}`, { token: t.token });
  assert.equal(det.body.solicitud.direccion, undefined);
});

test('custodia: el cliente cancela después de pagar y queda un reembolso pendiente', async () => {
  const { c, id } = await hastaCotizada();
  await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: c.token, body: { motivo: 'Ya lo arreglé' } });
  assert.equal(res.status, 200);
  assert.match(res.body.mensaje, /devolveremos \$1160\.00/);
  assert.equal(res.body.solicitud.estado, 'CANCELADA');
  assert.equal(res.body.solicitud.estado_pago, 'REEMBOLSO_PENDIENTE');
  const k = await getPool().query('SELECT estado FROM custodias WHERE id_solicitud = $1', [id]);
  assert.equal(k.rows[0].estado, 'REEMBOLSO_PENDIENTE');
});

test('custodia: al confirmar con conceptos extra solo se cobra la diferencia y la custodia se libera', async () => {
  const { c, t, id, metodo } = await hastaEnProceso();
  await api(server.url, 'POST', `/api/solicitudes/${id}/conceptos`, { token: t.token, body: { tipo: 'EXTRA', descripcion: 'Pastilla termomagnética 20A', monto: '185.50' } });
  await subirEvidencia(t.token, id);
  await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(res.status, 200);
  assert.equal(res.body.pago.monto, '1345.5000');
  assert.match(res.body.pago.referencia, /\+/, 'junta la referencia de la custodia y la del cobro adicional');
  const k = await getPool().query('SELECT estado FROM custodias WHERE id_solicitud = $1', [id]);
  assert.equal(k.rows[0].estado, 'LIBERADO');
});

test('si el folio generado ya existe, se genera otro en vez de fallar', async () => {
  const S = require('../src/services/solicitudes');
  const c = await cliente();
  const original = S.folio;
  const primera = (await crearSolicitud(c.token)).body.solicitud;
  let llamadas = 0;
  S.folio = (prefix) => (prefix === 'SRV' && (llamadas += 1) === 1 ? primera.folio : original(prefix));
  try {
    const res = await crearSolicitud(c.token);
    assert.equal(res.status, 201);
    assert.notEqual(res.body.solicitud.folio, primera.folio);
  } finally {
    S.folio = original;
  }
});

test('un técnico suspendido no se puede proponer y su latido lo deja fuera de línea', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await getPool().query("UPDATE usuarios SET estado_cuenta = 'SUSPENDIDO' WHERE id_usuario = $1", [t.id]);
  const prop = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/proponer-tecnico`, { token: c.token, body: { id_tecnico: t.id } });
  assert.equal(prop.status, 409);
  assert.equal(prop.body.code, 'TECH_UNAVAILABLE');
  const cerca = await api(server.url, 'GET', '/api/tecnicos/cercanos?latitud=17.96&longitud=-102.2', { token: c.token });
  assert.equal(cerca.body.tecnicos.some((x) => x.id_usuario === t.id), false);
  const latido = await api(server.url, 'POST', '/api/tecnico/latido', { token: t.token, body: {} });
  assert.equal(latido.body.disponible, false);
});

test('programar para hoy a una hora que ya pasó se rechaza; hoy en México sí se acepta', async () => {
  const { nowMx } = require('../src/lib/dates');
  const c = await cliente();
  const ahora = nowMx();
  if (ahora.hora !== '00:00') {
    const pasada = await crearSolicitud(c.token, { fecha_preferida: ahora.fecha, hora_preferida: '00:00' });
    assert.equal(pasada.status, 400);
    assert.equal(pasada.body.field, 'hora_preferida');
  }
  if (ahora.hora < '23:58') {
    const luego = await crearSolicitud(c.token, { fecha_preferida: ahora.fecha, hora_preferida: '23:59' });
    assert.equal(luego.status, 201);
  }
});

test('un cliente pendiente de aprobación no puede crear solicitudes', async () => {
  const c = await cliente({ aprobado: false });
  const res = await crearSolicitud(c.token);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'ACCOUNT_PENDING');
});

test('un técnico pendiente de aprobación no puede aceptar', async () => {
  const c = await cliente();
  const t = await tecnico({ aprobado: false });
  const s = (await crearSolicitud(c.token)).body.solicitud;
  const res = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'ACCOUNT_PENDING');
});

test('crear solicitud dos veces con la misma clave genera una sola', async () => {
  const c = await cliente();
  const headers = idem();
  const a = await crearSolicitud(c.token, {}, headers);
  const b = await crearSolicitud(c.token, {}, headers);
  assert.equal(a.status, 201);
  assert.equal(b.body.solicitud.id_solicitud, a.body.solicitud.id_solicitud);
  const n = await getPool().query('SELECT COUNT(*)::int AS n FROM solicitudes_servicio WHERE id_usuario = $1', [c.id]);
  assert.equal(n.rows[0].n, 1);
});

test('descripción vacía o categoría inexistente se rechazan', async () => {
  const c = await cliente();
  assert.equal((await crearSolicitud(c.token, { descripcion: ' ' })).status, 400);
  assert.equal((await crearSolicitud(c.token, { categoria: 'NADA' })).status, 400);
});

test('dos técnicos aceptan a la vez: solo uno obtiene la solicitud', async () => {
  const c = await cliente();
  const [t1, t2] = await Promise.all([tecnico(), tecnico()]);
  const s = (await crearSolicitud(c.token)).body.solicitud;
  const [r1, r2] = await Promise.all([
    api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t1.token }),
    api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t2.token }),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
});

test('descartar oculta la solicitud solo para ese técnico', async () => {
  const c = await cliente();
  const [t1, t2] = await Promise.all([tecnico(), tecnico()]);
  const s = (await crearSolicitud(c.token)).body.solicitud;
  assert.equal((await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/descartar`, { token: t1.token })).status, 200);
  const n1 = await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: t1.token });
  const n2 = await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: t2.token });
  assert.equal(n1.body.solicitudes.some((x) => x.id_solicitud === s.id_solicitud), false);
  assert.equal(n2.body.solicitudes.some((x) => x.id_solicitud === s.id_solicitud), true);
  const estado = await getPool().query('SELECT estado FROM solicitudes_servicio WHERE id_solicitud = $1', [s.id_solicitud]);
  assert.equal(estado.rows[0].estado, 'PENDIENTE');
});

test('el técnico no ve el teléfono ni la dirección exacta hasta el pago en custodia, ni siquiera asignado', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  const antes = await api(server.url, 'GET', `/api/solicitudes/${s.id_solicitud}`, { token: t.token });
  assert.equal(antes.status, 200);
  assert.equal(antes.body.solicitud.cliente_telefono, undefined);
  assert.equal(antes.body.solicitud.direccion, undefined);
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  const despues = await api(server.url, 'GET', `/api/solicitudes/${s.id_solicitud}`, { token: t.token });
  assert.equal(despues.body.solicitud.cliente_telefono, undefined);
  assert.equal(despues.body.solicitud.direccion, undefined);
  assert.ok(despues.body.solicitud.zona, 've solo la zona aproximada');
  assert.ok(despues.body.solicitud.tareas.length > 0, 'se cargan tareas de plantilla');
});

test('otro cliente no puede ver una solicitud ajena', async () => {
  const c = await cliente();
  const otro = await cliente();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  const res = await api(server.url, 'GET', `/api/solicitudes/${s.id_solicitud}`, { token: otro.token });
  assert.equal(res.status, 404);
});

test('finalizar sin evidencia se rechaza y con evidencia pasa a POR_CONFIRMAR', async () => {
  const { t, id } = await hastaEnProceso();
  const sin = await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  assert.equal(sin.status, 400);
  assert.equal(sin.body.code, 'EVIDENCE_REQUIRED');
  assert.equal((await subirEvidencia(t.token, id)).status, 201);
  const fin = await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.solicitud.estado, 'POR_CONFIRMAR');
});

test('confirmar y pagar: un solo cobro, total del servidor y liquidación con retenciones', async () => {
  const { c, t, id } = await hastaEnProceso();
  await subirEvidencia(t.token, id);
  await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  const metodo = await tarjeta(c.id);
  const headers = idem();
  const body = { id_metodo: metodo, monto: '1.00', calificacion: 5, comentario: 'Muy profesional' };
  const a = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers, body });
  const b = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers, body });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.solicitud.estado, 'FINALIZADA');
  assert.equal(a.body.pago.monto, '1160.0000');
  assert.deepEqual(a.body.desglose, { total: '1160.00', comision: '116.00', base: '1000.00', retencion_isr: '21.00', retencion_iva: '80.00', neto_tecnico: '943.00' });
  const pagos = await getPool().query('SELECT COUNT(*)::int AS n FROM pagos WHERE id_solicitud = $1', [id]);
  assert.equal(pagos.rows[0].n, 1);
  const saldo = await getPool().query('SELECT saldo_actual FROM billetera_tecnico WHERE id_usuario = $1', [t.id]);
  assert.equal(saldo.rows[0].saldo_actual, '943.0000');
  const garantia = await getPool().query('SELECT garantia_hasta - CURRENT_DATE AS dias FROM solicitudes_servicio WHERE id_solicitud = $1', [id]);
  assert.equal(garantia.rows[0].dias, 90);
});

test('tarjeta declinada responde 402 y la orden sigue por confirmar', async () => {
  const { c, t, id } = await hastaEnProcesoSinCustodia();
  await subirEvidencia(t.token, id);
  await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  const metodo = await tarjeta(c.id, 'tok_test_card_declined', '0002');
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'PAYMENT_DECLINED');
  const row = await getPool().query('SELECT estado FROM solicitudes_servicio WHERE id_solicitud = $1', [id]);
  assert.equal(row.rows[0].estado, 'POR_CONFIRMAR');
});

test('tras un rechazo, el reintento con otra tarjeta y la misma clave sí cobra', async () => {
  const { c, t, id } = await hastaEnProcesoSinCustodia();
  await subirEvidencia(t.token, id);
  await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  const mala = await tarjeta(c.id, 'tok_test_card_declined', '0002');
  const buena = await tarjeta(c.id);
  const headers = idem();
  const rechazo = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers, body: { id_metodo: mala } });
  assert.equal(rechazo.status, 402);
  const pago = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers, body: { id_metodo: buena } });
  assert.equal(pago.status, 200);
  assert.equal(pago.body.solicitud.estado, 'FINALIZADA');
});

test('si la pasarela no confirma el cobro, la orden queda en PROCESANDO y un reintento no vuelve a cobrar', async () => {
  const { c, t, id } = await hastaEnProcesoSinCustodia();
  await subirEvidencia(t.token, id);
  await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  const metodo = await tarjeta(c.id);
  const realFetch = global.fetch;
  let cobros = 0;
  // Conekta recibe la orden pero la respuesta no llega a tiempo: no se sabe si se cobró.
  global.fetch = async (url, opts) => {
    if (String(url).startsWith('https://api.conekta.io')) {
      cobros += 1;
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
    return realFetch(url, opts);
  };
  process.env.CONEKTA_PRIVATE_KEY = 'key_prueba';
  try {
    const a = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
    assert.equal(a.status, 503);
    assert.equal(a.body.code, 'PAYMENT_UNCERTAIN');
    const b = await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers: idem(), body: { id_metodo: metodo } });
    assert.equal(b.status, 409);
    assert.equal(b.body.code, 'PAYMENT_IN_PROGRESS');
    assert.equal(cobros, 1);
    const row = await getPool().query('SELECT estado, estado_pago FROM solicitudes_servicio WHERE id_solicitud = $1', [id]);
    assert.deepEqual(row.rows[0], { estado: 'POR_CONFIRMAR', estado_pago: 'PROCESANDO' });
  } finally {
    global.fetch = realFetch;
    delete process.env.CONEKTA_PRIVATE_KEY;
  }
});

test('concepto extra durante el trabajo recalcula el total en el servidor', async () => {
  const { t, id } = await hastaEnProceso();
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/conceptos`, {
    token: t.token, body: { tipo: 'EXTRA', descripcion: 'Pastilla termomagnética 20A', monto: '185.50' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.solicitud.monto_total, '1345.5000');
});

test('monto con más de dos decimales o negativo se rechaza', async () => {
  const { t, id } = await hastaEnProceso();
  for (const monto of ['10.123', '-5', 'abc']) {
    const res = await api(server.url, 'POST', `/api/solicitudes/${id}/conceptos`, { token: t.token, body: { tipo: 'EXTRA', descripcion: 'X', monto } });
    assert.equal(res.status, 400, `monto ${monto}`);
  }
});

test('el cliente cancela sin cargo antes de iniciar el trabajo; después ya no', async () => {
  const c = await cliente();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  const res = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/cancelar`, { token: c.token, body: { motivo: 'Ya no lo necesito' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.solicitud.estado, 'CANCELADA');
  assert.equal(res.body.solicitud.estado_pago, 'NO_APLICA');
  const { c: c2, id } = await hastaEnProceso();
  const tarde = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: c2.token, body: { motivo: 'x' } });
  assert.equal(tarde.status, 409);
});

test('el técnico cancela en ruta: la solicitud vuelve a buscar técnico sin él y la custodia se reembolsa', async () => {
  const { c, t, id } = await hastaCotizada();
  await api(server.url, 'POST', `/api/solicitudes/${id}/custodia`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  assert.equal((await api(server.url, 'PATCH', `/api/solicitudes/${id}/estado`, { token: t.token, body: { estado: 'EN_CAMINO' } })).status, 200);
  const sinMotivo = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: t.token, body: {} });
  assert.equal(sinMotivo.status, 400);
  const res = await api(server.url, 'POST', `/api/solicitudes/${id}/cancelar`, { token: t.token, body: { motivo: 'Se descompuso mi vehículo' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.solicitud.estado, 'PENDIENTE');
  assert.equal(res.body.solicitud.id_tecnico, null);
  const nuevas = await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: t.token });
  assert.equal(nuevas.body.solicitudes.some((x) => x.id_solicitud === id), false);
  const row = await getPool().query('SELECT estado_pago, direccion_liberada FROM solicitudes_servicio WHERE id_solicitud = $1', [id]);
  assert.deepEqual(row.rows[0], { estado_pago: 'REEMBOLSO_PENDIENTE', direccion_liberada: false });
  const k = await getPool().query('SELECT estado FROM custodias WHERE id_solicitud = $1', [id]);
  assert.equal(k.rows[0].estado, 'REEMBOLSO_PENDIENTE');
});

test('incidencia "no se presentó" suspende la orden; reasignar y cancelar sin cargo', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  const inc = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/incidencias`, {
    token: c.token, body: { tipo: 'NO_SE_PRESENTO', descripcion: 'Esperé dos horas y nunca llegó.' },
  });
  assert.equal(inc.status, 201);
  assert.match(inc.body.incidencia.folio, /^INC-/);
  assert.equal(inc.body.solicitud.estado, 'SUSPENDIDA');
  const reasignar = await api(server.url, 'POST', `/api/incidencias/${inc.body.incidencia.id_incidencia}/resolver`, { token: c.token, body: { accion: 'REASIGNAR' } });
  assert.equal(reasignar.body.solicitud.estado, 'PENDIENTE');
  assert.equal(reasignar.body.solicitud.id_tecnico, null);

  const t2 = await tecnico();
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t2.token });
  const inc2 = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/incidencias`, {
    token: c.token, body: { tipo: 'NO_SE_PRESENTO', descripcion: 'Tampoco llegó el segundo técnico.' },
  });
  const cancelar = await api(server.url, 'POST', `/api/incidencias/${inc2.body.incidencia.id_incidencia}/resolver`, { token: c.token, body: { accion: 'CANCELAR' } });
  assert.equal(cancelar.body.solicitud.estado, 'CANCELADA');
  assert.equal(cancelar.body.solicitud.estado_pago, 'NO_APLICA');
});

test('el cliente no puede cerrar el SOS ni retirar el reporte que hizo el técnico', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  const sos = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/sos`, { token: t.token, headers: idem(), body: { latitud: 17.95, longitud: -102.2 } });
  assert.equal(sos.status, 200);
  const cerrarSos = await api(server.url, 'POST', `/api/incidencias/${sos.body.incidencia.id_incidencia}/resolver`, { token: c.token, body: { accion: 'CONTINUAR' } });
  assert.equal(cerrarSos.status, 403);
  const abierta = await getPool().query('SELECT estado FROM incidencias WHERE id_incidencia = $1', [sos.body.incidencia.id_incidencia]);
  assert.equal(abierta.rows[0].estado, 'ABIERTA');

  const rep = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/incidencias`, {
    token: t.token, body: { tipo: 'OTRO', descripcion: 'El domicilio no coincide con la dirección indicada.' },
  });
  const retirar = await api(server.url, 'POST', `/api/incidencias/${rep.body.incidencia.id_incidencia}/resolver`, { token: c.token, body: { accion: 'CONTINUAR' } });
  assert.equal(retirar.status, 403);
  const propio = await api(server.url, 'POST', `/api/incidencias/${rep.body.incidencia.id_incidencia}/resolver`, { token: t.token, body: { accion: 'CONTINUAR' } });
  assert.equal(propio.status, 200);
  assert.equal(propio.body.solicitud.estado, 'ESPERANDO_APROBACION', 'vuelve a esperar el pago del precio base');
});

test('reprogramación: el técnico propone, el cliente contrapropone y el técnico acepta', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  const manana = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const pasado = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const prop = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/reprogramaciones`, {
    token: t.token, body: { fecha: manana, hora: '16:00', motivo: 'Me surgió una urgencia' },
  });
  assert.equal(prop.status, 201);
  const contra = await api(server.url, 'PATCH', `/api/reprogramaciones/${prop.body.reprogramacion.id_reprogramacion}`, {
    token: c.token, body: { respuesta: 'RECHAZAR', contrapropuesta: { fecha: pasado, hora: '09:00' } },
  });
  assert.equal(contra.status, 200);
  const nueva = contra.body.contrapropuesta;
  const ok = await api(server.url, 'PATCH', `/api/reprogramaciones/${nueva.id_reprogramacion}`, { token: t.token, body: { respuesta: 'ACEPTAR' } });
  assert.equal(ok.status, 200);
  const row = await getPool().query("SELECT to_char(fecha_preferida, 'YYYY-MM-DD') AS f, to_char(hora_preferida, 'HH24:MI') AS h FROM solicitudes_servicio WHERE id_solicitud = $1", [s.id_solicitud]);
  assert.deepEqual(row.rows[0], { f: pasado, h: '09:00' });
});

test('quien propuso no puede aceptar su propia reprogramación', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  const fecha = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const prop = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/reprogramaciones`, { token: t.token, body: { fecha, hora: '12:00' } });
  const res = await api(server.url, 'PATCH', `/api/reprogramaciones/${prop.body.reprogramacion.id_reprogramacion}`, { token: t.token, body: { respuesta: 'ACEPTAR' } });
  assert.equal(res.status, 403);
});

test('calificación bidireccional queda en una sola fila', async () => {
  const { c, t, id } = await hastaEnProceso();
  await subirEvidencia(t.token, id);
  await api(server.url, 'POST', `/api/solicitudes/${id}/finalizar`, { token: t.token, headers: idem() });
  await api(server.url, 'POST', `/api/solicitudes/${id}/confirmar`, { token: c.token, headers: idem(), body: { id_metodo: await tarjeta(c.id) } });
  assert.equal((await api(server.url, 'POST', `/api/solicitudes/${id}/calificar`, { token: c.token, body: { calificacion: 4, comentario: 'Bien' } })).status, 200);
  assert.equal((await api(server.url, 'POST', `/api/solicitudes/${id}/calificar-cliente`, { token: t.token, body: { calificacion: 5, comentario: 'Cliente amable' } })).status, 200);
  const row = await getPool().query('SELECT puntuacion_tecnico, puntuacion_cliente FROM calificaciones_servicio WHERE id_solicitud = $1', [id]);
  assert.deepEqual(row.rows[0], { puntuacion_tecnico: 4, puntuacion_cliente: 5 });
});

test('chat: solo participantes; los adjuntos llegan con URL firmada', async () => {
  const c = await cliente();
  const t = await tecnico();
  const intruso = await cliente();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  await simularPrecioBasePagado(s.id_solicitud);
  assert.equal((await api(server.url, 'GET', `/api/solicitudes/${s.id_solicitud}/chat`, { token: intruso.token })).status, 403);
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/chat/politicas`, { token: c.token });
  const form = new FormData();
  form.append('mensaje', 'Así se ve el contacto');
  form.append('adjunto', new Blob([PNG], { type: 'image/png' }), 'foto.png');
  const sent = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/chat`, { token: c.token, form });
  assert.equal(sent.status, 201);
  const list = await api(server.url, 'GET', `/api/solicitudes/${s.id_solicitud}/chat`, { token: t.token });
  assert.match(list.body.mensajes[0].adjunto_url, /^\/api\/archivos\/\d+\?exp=/);
  assert.equal(list.body.mensajes[0].mensaje, 'Así se ve el contacto');
});

test('SOS con la misma clave registra una sola alerta e incidencia de seguridad', async () => {
  const c = await cliente();
  const t = await tecnico();
  const s = (await crearSolicitud(c.token)).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: t.token });
  const headers = idem();
  const body = { latitud: 17.95, longitud: -102.19 };
  const a = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/sos`, { token: c.token, headers, body });
  const b = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/sos`, { token: c.token, headers, body });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const n = await getPool().query("SELECT COUNT(*)::int AS n FROM incidencias WHERE id_solicitud = $1 AND tipo = 'SEGURIDAD'", [s.id_solicitud]);
  assert.equal(n.rows[0].n, 1);
});

test('NUEVAS incluye la distancia y los contadores del panel', async () => {
  const c = await cliente();
  const t = await tecnico();
  await crearSolicitud(c.token);
  const res = await api(server.url, 'GET', '/api/solicitudes/tecnico?vista=nuevas', { token: t.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.solicitudes[0].distancia_km !== undefined);
  assert.equal(res.body.solicitudes[0].mi_precio, '300.00', 'sin precio propio, el sugerido de la categoría');
  assert.equal(typeof res.body.contadores.nuevas, 'number');
});

test('las fotos de la solicitud se sirven con URL firmada (sin cabecera de sesión)', async () => {
  const c = await cliente();
  const form = new FormData();
  form.append('categoria', 'PLOMERIA');
  form.append('descripcion', 'Gotea la llave del fregadero de la cocina.');
  form.append('direccion', 'Calle 9 #12, Centro');
  form.append('imagenes', new Blob([PNG], { type: 'image/png' }), 'fuga.png');
  const s = await api(server.url, 'POST', '/api/solicitudes', { token: c.token, headers: idem(), form });
  assert.equal(s.status, 201);
  const det = await api(server.url, 'GET', `/api/solicitudes/${s.body.solicitud.id_solicitud}`, { token: c.token });
  assert.match(det.body.solicitud.imagenes[0].url, /\?exp=\d+&sig=/);
  const res = await fetch(server.url + det.body.solicitud.imagenes[0].url);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
});
