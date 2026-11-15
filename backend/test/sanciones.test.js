const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, startServer, createUser, api, login, idem, getPool, closePool, simularPrecioBasePagado } = require('./helpers');
const { MENSAJES } = require('../src/services/sanciones');

let server;
test.before(async () => { await resetDb(); server = await startServer(); });
test.after(async () => { await server.close(); await closePool(); });

async function usuario(rol, opts = {}) {
  const u = await createUser({ rol, ...(rol === 2 ? { latitud: 17.96, longitud: -102.2, disponible: true } : {}), ...opts });
  return { ...u, token: await login(server.url, u) };
}

// Conversación directa con las políticas del chat ya aceptadas por las dos partes.
async function conversacion() {
  const cliente = await usuario(1);
  const tecnico = await usuario(2);
  const abierta = await api(server.url, 'POST', '/api/chat-directo', { token: cliente.token, body: { id_tecnico: tecnico.id } });
  const id = abierta.body.conversacion.id_conversacion;
  for (const u of [cliente, tecnico]) await api(server.url, 'POST', `/api/chat-directo/${id}/politicas`, { token: u.token });
  return { cliente, tecnico, id };
}

const escribir = (u, id, mensaje) => api(server.url, 'POST', `/api/chat-directo/${id}/mensajes`, { token: u.token, body: { mensaje } });

// Saca las infracciones anteriores de la ventana de "mismo intento" (10 minutos) para simular otro intento.
// También envejece sus mensajes directos para que el límite de mensajes antes de contratar no interfiera.
const pasaTiempo = async (idUsuario) => {
  await getPool().query("UPDATE infracciones SET fecha = fecha - INTERVAL '15 minutes' WHERE id_usuario = $1", [idUsuario]);
  await getPool().query("UPDATE mensajes_directos SET fecha_envio = fecha_envio - INTERVAL '31 days' WHERE id_emisor = $1", [idUsuario]);
};

test('escala completa: aviso → 24 h → 7 días con baja prioridad → baneo', async () => {
  const { cliente, id } = await conversacion();

  // Nivel 1: advertencia; el mensaje ya llegó bloqueado.
  const n1 = await escribir(cliente, id, 'mándame whats al 7531234567');
  assert.equal(n1.status, 201);
  assert.equal(n1.body.filtrado.sancion.nivel, 1);
  assert.equal(n1.body.filtrado.sancion.mensaje, MENSAJES[1]);

  // Otro mensaje en la misma ráfaga cuenta como el mismo intento.
  const rafaga = await escribir(cliente, id, 'es el 753 123 4567');
  assert.equal(rafaga.body.filtrado.bloqueado, true);
  assert.equal(rafaga.body.filtrado.sancion, null);

  // Nivel 2: segundo intento en 30 días → 24 h sin poder pedir trabajos.
  await pasaTiempo(cliente.id);
  const n2 = await escribir(cliente, id, 'te pago en efectivo');
  assert.equal(n2.body.filtrado.sancion.nivel, 2);
  assert.equal(n2.body.filtrado.sancion.mensaje, MENSAJES[2]);
  const pide = await api(server.url, 'POST', '/api/solicitudes', {
    token: cliente.token, headers: idem(),
    body: { categoria: 'PLOMERIA', descripcion: 'Fuga en el lavabo del baño principal.', direccion: 'Calle 8 #3, Centro' },
  });
  assert.equal(pide.status, 403);
  assert.equal(pide.body.code, 'ACCOUNT_SUSPENDED_TEMP');
  const yo = await api(server.url, 'GET', '/api/me', { token: cliente.token });
  assert.ok(yo.body.usuario.suspendido_hasta, 'la app sabe que está suspendido');
  const horas = (new Date(yo.body.usuario.suspendido_hasta) - Date.now()) / 3600000;
  assert.ok(horas > 23 && horas <= 24, `suspensión de ~24 h (${horas.toFixed(2)})`);

  // Nivel 3: reincide tras la suspensión de 24 h → 7 días + baja prioridad.
  await pasaTiempo(cliente.id);
  const n3 = await escribir(cliente, id, 'búscame en face');
  assert.equal(n3.body.filtrado.sancion.nivel, 3);
  const u3 = (await getPool().query('SELECT suspendido_hasta, prioridad_baja_hasta FROM usuarios WHERE id_usuario = $1', [cliente.id])).rows[0];
  const dias = (new Date(u3.suspendido_hasta) - Date.now()) / 86400000;
  assert.ok(dias > 6.9 && dias <= 7, `suspensión de ~7 días (${dias.toFixed(2)})`);
  assert.ok(new Date(u3.prioridad_baja_hasta) > new Date(u3.suspendido_hasta));

  // Nivel 4: reincide otra vez → baneo definitivo; la sesión se cierra y ya no puede entrar.
  await pasaTiempo(cliente.id);
  const n4 = await escribir(cliente, id, 'mi correo es yo@gmail.com');
  assert.equal(n4.body.filtrado.sancion.nivel, 4);
  const sesion = await api(server.url, 'GET', '/api/me', { token: cliente.token });
  assert.equal(sesion.status, 401);
  const entra = await api(server.url, 'POST', '/api/login', { body: { email: cliente.email, password: cliente.password } });
  assert.equal(entra.status, 403);
  assert.equal(entra.body.code, 'ACCOUNT_BANNED');
  assert.equal(entra.body.error, MENSAJES[4]);
});

test('cancelar un pedido después de intentar compartir contacto en su chat es nivel 2', async () => {
  const cliente = await usuario(1);
  const tecnico = await usuario(2);
  const s = (await api(server.url, 'POST', '/api/solicitudes', {
    token: cliente.token, headers: idem(),
    body: { categoria: 'PINTURA', descripcion: 'Pintar recámara de 3 por 4 metros.', direccion: 'Calle 3 #4, Centro' },
  })).body.solicitud;
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/aceptar`, { token: tecnico.token });
  await simularPrecioBasePagado(s.id_solicitud);
  await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/chat/politicas`, { token: cliente.token });
  const msg = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/chat`, { token: cliente.token, body: { mensaje: 'mejor por fuera, te paso mi whats' } });
  assert.equal(msg.body.filtrado.sancion.nivel, 1);

  const cancela = await api(server.url, 'POST', `/api/solicitudes/${s.id_solicitud}/cancelar`, { token: cliente.token, body: { motivo: 'Ya no' } });
  assert.equal(cancela.status, 200);
  assert.equal(cancela.body.sancion.nivel, 2);
});

test('un técnico suspendido no puede ponerse en línea ni aceptar trabajos', async () => {
  const { tecnico, id } = await conversacion();
  await escribir(tecnico, id, 'llámame al 7531234567');
  await pasaTiempo(tecnico.id);
  const n2 = await escribir(tecnico, id, 'pago en efectivo');
  assert.equal(n2.body.filtrado.sancion.nivel, 2);
  const enLinea = await api(server.url, 'PUT', '/api/tecnico/disponibilidad', { token: tecnico.token, body: { disponible: true } });
  assert.equal(enLinea.status, 403);
  assert.equal(enLinea.body.code, 'ACCOUNT_SUSPENDED_TEMP');
});
