const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { resetDb, startServer, api, closePool } = require('./helpers');
const fx = require('./fixtures/ine');
const { evaluarRespuesta, MOTIVOS } = require('../src/services/didit');
const { readTicket } = require('../src/lib/ine/ticket');
const { closeOcr } = require('../src/services/ineVerifier');

const REGISTRO = { nombre: 'José Luis', apellidos: 'Pérez García', fecha_nacimiento: '1985-03-12' };

// Respuesta de Didit para una INE válida de la persona del registro (formato de /v3/id-verification/).
function aprobada(cambios = {}) {
  return {
    request_id: 'f61681b8-9422-4378-ac3e-04c6a247fb45',
    id_verification: {
      status: 'Approved',
      document_type: 'Identity Card',
      document_number: 'PRGRJS85031216H400',
      personal_number: 'PEGL850312HMNRRS08',
      date_of_birth: '1985-03-12',
      expiration_date: '2033-12-31',
      issuing_state: 'MEX',
      issuing_state_name: 'Mexico',
      first_name: 'JOSE LUIS',
      last_name: 'PEREZ GARCIA',
      full_name: 'JOSE LUIS PEREZ GARCIA',
      gender: 'M',
      warnings: [],
      ...cambios,
    },
  };
}

// ───────────────────────── Evaluación de la respuesta ─────────────────────────
test('Didit: INE aprobada con los datos del registro → válida, con CURP y sexo en formato INE', () => {
  const r = evaluarRespuesta(aprobada(), REGISTRO, '2026-11-02');
  assert.equal(r.ok, true, JSON.stringify(r.comprobaciones));
  assert.equal(r.datos.curp, 'PEGL850312HMNRRS08');
  assert.equal(r.datos.documento, 'PEGL850312HMNRRS08');
  assert.equal(r.datos.sexo, 'H');
});

test('Didit: rechazos por foto de pantalla, vencida o en revisión dan un motivo claro', () => {
  const pantalla = evaluarRespuesta(aprobada({ status: 'Declined', warnings: [{ risk: 'SCREEN_CAPTURE_DETECTED', log_type: 'error' }] }), REGISTRO);
  assert.equal(pantalla.ok, false);
  assert.equal(pantalla.motivo, MOTIVOS.copia);
  const vencida = evaluarRespuesta(aprobada({ status: 'Declined', warnings: [{ risk: 'DOCUMENT_EXPIRED', log_type: 'error' }] }), REGISTRO);
  assert.equal(vencida.motivo, MOTIVOS.vencida);
  assert.equal(evaluarRespuesta(aprobada({ status: 'In Review' }), REGISTRO).motivo, MOTIVOS.revision);
});

test('Didit: aprobada pero de otra persona, de otro país o vencida no pasa', () => {
  assert.equal(evaluarRespuesta(aprobada({ date_of_birth: '1990-01-01' }), REGISTRO).motivo, MOTIVOS.datos);
  assert.equal(evaluarRespuesta(aprobada({ full_name: 'MARIA LOPEZ RUIZ', first_name: 'MARIA', last_name: 'LOPEZ RUIZ' }), REGISTRO).motivo, MOTIVOS.datos);
  assert.equal(evaluarRespuesta(aprobada({ issuing_state: 'USA', issuing_state_name: 'United States' }), REGISTRO).motivo, MOTIVOS.noMexicana);
  assert.equal(evaluarRespuesta(aprobada({ expiration_date: '2020-12-31' }), REGISTRO, '2026-11-02').motivo, MOTIVOS.vencida);
});

test('Didit: sin CURP legible usa el número del documento para ligar los dos lados', () => {
  const r = evaluarRespuesta(aprobada({ personal_number: null }), REGISTRO, '2026-11-02');
  assert.equal(r.ok, true);
  assert.equal(r.datos.curp, null);
  assert.equal(r.datos.documento, 'PRGRJS85031216H400');
});

test('Didit Sandbox: acepta la persona ficticia sin comparar país ni nombre, solo en modo de prueba', () => {
  const ficticia = { request_id: 'req-sandbox', id_verification: { status: 'Approved', issuing_state: 'USA', full_name: 'Sandbox User', date_of_birth: '1990-01-15', warnings: [] } };
  assert.equal(evaluarRespuesta(ficticia, REGISTRO, '2026-11-02').ok, false, 'sin modo de prueba se rechaza');
  const r = evaluarRespuesta(ficticia, REGISTRO, '2026-11-02', { sandbox: true });
  assert.equal(r.ok, true);
  assert.equal(r.datos.documento, 'req-sandbox');
  assert.equal(r.datos.fecha_nacimiento, REGISTRO.fecha_nacimiento);
  const declinada = { id_verification: { status: 'Declined', warnings: [{ log_type: 'error', risk: 'SCREEN_CAPTURE_DETECTED' }] } };
  assert.equal(evaluarRespuesta(declinada, REGISTRO, '2026-11-02', { sandbox: true }).ok, false, 'un rechazo de Didit sigue siendo rechazo');
});

// ───────────────────────── Ruta con un Didit falso ─────────────────────────
let server;
let fakeDidit;
let diditResponse = { status: 200, body: aprobada() };
let llamadas = [];
let ocupadoUnaVez = false;

test.before(async () => {
  fakeDidit = http.createServer((req, res) => {
    let size = 0;
    req.on('data', (c) => { size += c.length; });
    req.on('end', () => {
      llamadas.push({ apiKey: req.headers['x-api-key'], contentType: req.headers['content-type'], size });
      // Una respuesta "ocupado" de un solo uso antes de la normal (Didit pide reenviar el mismo archivo).
      const r = ocupadoUnaVez ? { status: 503, body: { code: 'document_processing_busy' } } : diditResponse;
      ocupadoUnaVez = false;
      res.writeHead(r.status, { 'Content-Type': 'application/json', 'Retry-After': '1' });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => fakeDidit.listen(0, r));
  process.env.DIDIT_API_KEY = 'llave_de_prueba';
  process.env.DIDIT_API_URL = `http://127.0.0.1:${fakeDidit.address().port}/v3/id-verification/`;
  await resetDb();
  server = await startServer();
});

test.after(async () => {
  delete process.env.DIDIT_API_KEY;
  delete process.env.DIDIT_API_URL;
  await server.close();
  await new Promise((r) => fakeDidit.close(r));
  await closeOcr();
  await closePool();
});

const jpeg = (buf) => new Blob([buf], { type: 'image/jpeg' });

function verificar(lado, foto, { ticket, frente } = {}) {
  const form = new FormData();
  form.append('lado', lado);
  form.append('nombre', REGISTRO.nombre);
  form.append('apellidos', REGISTRO.apellidos);
  form.append('fecha_nacimiento', REGISTRO.fecha_nacimiento);
  if (ticket) form.append('ticket_frente', ticket);
  form.append('foto', jpeg(foto), `${lado}.jpg`);
  if (frente) form.append('frente', jpeg(frente), 'frente.jpg');
  return api(server.url, 'POST', '/api/ine/verificar', { form });
}

test('con Didit: el frente solo revisa calidad; el reverso manda las dos caras y devuelve ambos tickets', async () => {
  llamadas = [];
  diditResponse = { status: 200, body: aprobada() };
  const fotoFrente = await fx.frente();
  const f = await verificar('frente', fotoFrente);
  assert.equal(f.body.ok, true, JSON.stringify(f.body));
  assert.equal(llamadas.length, 0, 'el frente no gasta un crédito de Didit');

  const r = await verificar('reverso', await fx.reverso(), { ticket: f.body.ticket, frente: fotoFrente });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].apiKey, 'llave_de_prueba');
  assert.match(llamadas[0].contentType, /multipart\/form-data/);

  const tFrente = readTicket(r.body.ticket_frente);
  const tReverso = readTicket(r.body.ticket);
  assert.equal(tFrente.lado, 'frente');
  assert.equal(tReverso.lado, 'reverso');
  assert.equal(tFrente.documento, tReverso.documento);
  assert.equal(tReverso.proveedor, 'didit');
});

test('con Didit: si responde "ocupado" (503) se reintenta una vez y la verificación sigue', async () => {
  llamadas = [];
  diditResponse = { status: 200, body: aprobada() };
  const fotoFrente = await fx.frente();
  const f = await verificar('frente', fotoFrente);
  ocupadoUnaVez = true;
  const r = await verificar('reverso', await fx.reverso(), { ticket: f.body.ticket, frente: fotoFrente });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(llamadas.length, 2, 'una llamada ocupada y su reintento');
});

test('con Didit: el reverso sin la misma foto del frente se rechaza sin llamar a Didit', async () => {
  llamadas = [];
  const f = await verificar('frente', await fx.frente());
  const r = await verificar('reverso', await fx.reverso(), { ticket: f.body.ticket, frente: await fx.reverso() });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'FRONT_REQUIRED');
  assert.equal(llamadas.length, 0);
});

test('con Didit: documento no reconocido es un rechazo; Didit caído o sin créditos responde 503', async () => {
  const fotoFrente = await fx.frente();
  const f = await verificar('frente', fotoFrente);

  diditResponse = { status: 400, body: { error: 'COULD_NOT_RECOGNIZE_DOCUMENT' } };
  const noDoc = await verificar('reverso', await fx.reverso(), { ticket: f.body.ticket, frente: fotoFrente });
  assert.equal(noDoc.body.ok, false);
  assert.equal(noDoc.body.motivo, MOTIVOS.noIne);
  assert.equal(noDoc.body.ticket, undefined);

  diditResponse = { status: 403, body: { error: "You don't have enough credits to perform this request." } };
  const sinCreditos = await verificar('reverso', await fx.reverso(), { ticket: f.body.ticket, frente: fotoFrente });
  assert.equal(sinCreditos.status, 503);
  assert.equal(sinCreditos.body.code, 'IDENTITY_SERVICE_UNAVAILABLE');
  diditResponse = { status: 200, body: aprobada() };
});
