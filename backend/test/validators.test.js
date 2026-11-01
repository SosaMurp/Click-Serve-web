const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidClabe, bankFromClabe, luhn, isEmail, isStrongPassword, maskClabe, normalizeEmail, normalizePhoneMx, normalizePersonName, normalizeCp, normalizeCedula, normalizeOtp } = require('../src/lib/validators');

test('CLABE con dígito verificador correcto es válida', () => {
  assert.equal(isValidClabe('002010077777777771'), true);
});

test('CLABE con dígito verificador incorrecto es inválida', () => {
  assert.equal(isValidClabe('002010077777777770'), false);
});

test('CLABE con longitud distinta de 18 o con letras es inválida', () => {
  assert.equal(isValidClabe('00201007777777777'), false);
  assert.equal(isValidClabe('00201007777777777A'), false);
});

test('el banco se obtiene de los tres primeros dígitos de la CLABE', () => {
  assert.equal(bankFromClabe('002010077777777771'), 'BANAMEX');
  assert.equal(bankFromClabe('012180012345678912'), 'BBVA MÉXICO');
});

test('la CLABE se enmascara dejando solo los últimos 4 dígitos', () => {
  assert.equal(maskClabe('002010077777777771'), '•••• •••• •••• 7771');
});

test('Luhn acepta la tarjeta de prueba 4242 4242 4242 4242', () => {
  assert.equal(luhn('4242 4242 4242 4242'), true);
});

test('Luhn rechaza un número con dígito alterado', () => {
  assert.equal(luhn('4242424242424241'), false);
});

test('isEmail valida formato básico', () => {
  assert.equal(isEmail('ana@correo.mx'), true);
  assert.equal(isEmail('ana@'), false);
});

test('contraseña fuerte exige 8+ caracteres, mayúscula, minúscula y número', () => {
  assert.equal(isStrongPassword('Prueba#2026'), true);
  assert.equal(isStrongPassword('prueba2026'), false);
  assert.equal(isStrongPassword('Pr1'), false);
});

test('correo: formato canónico y estructura estricta', () => {
  assert.equal(normalizeEmail('  Ana.Perez@Correo.MX '), 'ana.perez@correo.mx');
  for (const ok of ['ana@correo.mx', 'a.b+c@sub.dominio.com.mx', "o'brien@x.io"]) assert.equal(isEmail(ok), true, ok);
  for (const bad of ['ana@', '@correo.mx', 'ana@correo', 'ana@@correo.mx', 'a..b@correo.mx', '.ana@correo.mx', 'ana.@correo.mx', 'ana@correo..mx', 'ana@-correo.mx', 'ana perez@correo.mx', 'ana@correo.m', `${'a'.repeat(65)}@correo.mx`]) {
    assert.equal(isEmail(bad), false, bad);
  }
});

test('teléfono: acepta cualquier forma de escribirlo y devuelve 10 dígitos', () => {
  for (const v of ['7531234567', '753 123 4567', '753-123-4567', '(753) 123 4567', '+52 753 123 4567', '52 753 123 4567', '+52 1 753 123 4567']) {
    assert.equal(normalizePhoneMx(v), '7531234567', v);
  }
  for (const bad of ['', '123', '75312345678', '0531234567', '1531234567', '7777777777', '753123456a7x']) {
    assert.equal(normalizePhoneMx(bad), null, bad);
  }
});

test('nombres: solo letras, espacios, apóstrofo, punto y guion', () => {
  assert.equal(normalizePersonName('  María   José '), 'María José');
  assert.equal(normalizePersonName("D'Angelo-Peña Jr."), "D'Angelo-Peña Jr.");
  for (const bad of ['', 'A', 'Ana3', 'Ana <b>', '1234', '- -', 'x'.repeat(61)]) assert.equal(normalizePersonName(bad), null, bad);
});

test('código postal, cédula y código de verificación', () => {
  assert.equal(normalizeCp('60950'), '60950');
  assert.equal(normalizeCp('6095'), null);
  assert.equal(normalizeCedula(' 1234567 '), '1234567');
  assert.equal(normalizeCedula('123456'), null);
  assert.equal(normalizeOtp('123 456'), '123456');
  assert.equal(normalizeOtp('12345'), null);
});

test('contraseña: máximo 64 caracteres', () => {
  assert.equal(isStrongPassword(`Aa1${'x'.repeat(61)}`), true);
  assert.equal(isStrongPassword(`Aa1${'x'.repeat(62)}`), false);
});
