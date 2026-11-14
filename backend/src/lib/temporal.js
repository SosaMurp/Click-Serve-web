const crypto = require('crypto');

// Horas que vale la contraseña temporal de un coadministrador para su primer acceso.
const HORAS_TEMPORAL = 48;

// Sin caracteres que se confunden al leerlos (0/O, 1/l/I) para poder copiarla sin errores.
const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUS = 'abcdefghijkmnopqrstuvwxyz';
const DIGITOS = '23456789';

const pick = (set) => set[crypto.randomInt(set.length)];

// 12 caracteres con al menos una mayúscula, una minúscula y un dígito (cumple la regla de contraseña fuerte).
function generateTempPassword(length = 12) {
  const todos = MAYUS + MINUS + DIGITOS;
  const chars = [pick(MAYUS), pick(MINUS), pick(DIGITOS)];
  while (chars.length < length) chars.push(pick(todos));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { generateTempPassword, HORAS_TEMPORAL };
