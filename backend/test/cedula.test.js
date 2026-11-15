const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluarCedula, folioProfesional } = require('../src/services/cedula');

const cuenta = { nombre: 'Roberto', apellido: 'Pérez López' };
const registro = { nombre: 'ROBERTO CARLOS', paterno: 'PEREZ', materno: 'LOPEZ', titulo: 'INGENIERO ELECTRICISTA' };

test('evaluarCedula: existe, nombre y apellido coinciden (sin acentos) → ok con título', () => {
  const r = evaluarCedula([registro], cuenta);
  assert.equal(r.ok, true);
  assert.equal(r.titulo, 'INGENIERO ELECTRICISTA');
});

test('evaluarCedula: sin registros → NO_EXISTE', () => {
  const r = evaluarCedula([], cuenta);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'NO_EXISTE');
});

test('evaluarCedula: otro apellido → NOMBRE_NO_COINCIDE', () => {
  const r = evaluarCedula([{ ...registro, paterno: 'GOMEZ' }], cuenta);
  assert.equal(r.codigo, 'NOMBRE_NO_COINCIDE');
});

test('evaluarCedula: otro nombre → NOMBRE_NO_COINCIDE', () => {
  const r = evaluarCedula([{ ...registro, nombre: 'MARIA' }], cuenta);
  assert.equal(r.codigo, 'NOMBRE_NO_COINCIDE');
});

test('evaluarCedula: registro dado de baja o cancelado → NO_VIGENTE', () => {
  assert.equal(evaluarCedula([{ ...registro, estatus: 'CANCELADA' }], cuenta).codigo, 'NO_VIGENTE');
  assert.equal(evaluarCedula([{ ...registro, vigente: false }], cuenta).codigo, 'NO_VIGENTE');
});

test('evaluarCedula: registro vigente sin campo de estatus → ok', () => {
  assert.equal(evaluarCedula([{ ...registro, estatus: 'VIGENTE' }], cuenta).ok, true);
});

test('folioProfesional: identificador estable con ceros a la izquierda', () => {
  assert.equal(folioProfesional(42), 'CSP-000042');
});
