const argon2 = require('argon2');
const bcrypt = require('bcrypt');

// RNF-05: contraseñas con Argon2id (parámetros recomendados por OWASP: 19 MiB, 2 iteraciones, 1 hilo).
// Las contraseñas guardadas antes con bcrypt se siguen aceptando y se re-guardan con Argon2id
// la próxima vez que la persona inicia sesión (migración transparente, sin pedirle nada).
const OPCIONES = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

function esBcrypt(hash) {
  return typeof hash === 'string' && /^\$2[aby]\$/.test(hash);
}

async function hashPassword(plain) {
  return argon2.hash(String(plain), OPCIONES);
}

// Compara contra Argon2id o bcrypt según el formato guardado. Nunca lanza: un hash dañado es "no coincide".
async function verifyPassword(plain, hash) {
  if (!hash || typeof hash !== 'string') return false;
  try {
    if (esBcrypt(hash)) return await bcrypt.compare(String(plain), hash);
    if (hash.startsWith('$argon2')) return await argon2.verify(hash, String(plain));
  } catch {
    return false;
  }
  return false;
}

// Verdadero si el hash es bcrypt o Argon2 con parámetros más débiles: conviene re-guardarlo.
function needsRehash(hash) {
  if (esBcrypt(hash)) return true;
  try {
    return argon2.needsRehash(hash, OPCIONES);
  } catch {
    return true;
  }
}

// Hash ficticio para comparar en tiempo constante cuando la cuenta no existe (no revela si el correo está registrado).
let dummy;
async function dummyHash() {
  if (!dummy) dummy = await hashPassword('clave-ficticia-para-tiempo-constante');
  return dummy;
}

module.exports = { hashPassword, verifyPassword, needsRehash, dummyHash, esBcrypt };
