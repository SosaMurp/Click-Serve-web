// Validaciones de formato compartidas (RNF-29, RD-014). El servidor siempre valida aunque la app ya lo haga.

// Claves de banco del estándar ABM (tres primeros dígitos de la CLABE).
const BANKS = {
  '002': 'BANAMEX', '006': 'BANCOMEXT', '009': 'BANOBRAS', '012': 'BBVA MÉXICO', '014': 'SANTANDER',
  '019': 'BANJÉRCITO', '021': 'HSBC', '030': 'BAJÍO', '036': 'INBURSA', '042': 'MIFEL', '044': 'SCOTIABANK',
  '058': 'BANREGIO', '059': 'INVEX', '060': 'BANSI', '062': 'AFIRME', '072': 'BANORTE', '106': 'BANK OF AMERICA',
  '113': 'VE POR MÁS', '127': 'BANCO AZTECA', '128': 'AUTOFIN', '130': 'COMPARTAMOS', '136': 'INTERCAM',
  '137': 'BANCOPPEL', '138': 'ABC CAPITAL', '140': 'CONSUBANCO', '143': 'CIBANCO', '145': 'BBASE',
  '147': 'BANKAOOL', '148': 'PAGATODO', '152': 'BANCREA', '154': 'BANCO COVALTO', '155': 'ICBC',
  '156': 'SABADELL', '157': 'SHINHAN', '158': 'MIZUHO', '166': 'BANCO DEL BIENESTAR', '638': 'NU MÉXICO',
  '646': 'STP', '722': 'MERCADO PAGO', '728': 'SPIN BY OXXO',
};

const CLABE_WEIGHTS = [3, 7, 1];

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

// Dígito verificador: suma de (dígito × peso 3,7,1 mod 10) sobre los primeros 17; DV = (10 − suma mod 10) mod 10.
function isValidClabe(value) {
  const clabe = String(value ?? '').trim();
  if (!/^\d{18}$/.test(clabe)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += (Number(clabe[i]) * CLABE_WEIGHTS[i % 3]) % 10;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(clabe[17]);
}

function bankFromClabe(value) {
  return BANKS[String(value ?? '').slice(0, 3)] || null;
}

function maskClabe(value) {
  const clabe = onlyDigits(value);
  if (clabe.length < 4) return null;
  return `•••• •••• •••• ${clabe.slice(-4)}`;
}

function luhn(value) {
  const digits = onlyDigits(value);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// Formato canónico del correo: sin espacios alrededor y en minúsculas (así no hay cuentas duplicadas por mayúsculas).
function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

const EMAIL_LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DNS_TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

// Estructura de RFC 5321/5322 usable en la práctica: un solo @, parte local de hasta 64 caracteres sin puntos
// seguidos ni en los extremos, y un dominio con al menos un punto cuyas etiquetas son nombres DNS válidos.
function isEmail(value) {
  const email = normalizeEmail(value);
  if (email.length > 254) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) return false;
  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split('.');
  if (local.length > 64 || !EMAIL_LOCAL.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return labels.length >= 2 && labels.every((l) => DNS_LABEL.test(l)) && DNS_TLD.test(labels[labels.length - 1]);
}

// 8 a 64 caracteres con minúscula, mayúscula y número. El tope evita que bcrypt (que ignora lo que pasa de 72 bytes)
// acepte contraseñas más largas de lo que realmente compara.
function isStrongPassword(value) {
  const s = String(value ?? '');
  return s.length >= 8 && s.length <= 64 && Buffer.byteLength(s) <= 72 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);
}

// Celular o fijo de México a 10 dígitos. Acepta el formato como lo escriba la persona (753 123 4567, 753-123-4567,
// (753) 123 4567, +52 753 123 4567, 52…, 521…) y devuelve solo los 10 dígitos, o null si no es un número posible:
// la lada nunca empieza con 0 ni 1 y un número con todos los dígitos iguales no existe.
function normalizePhoneMx(value) {
  if (!/^[\d\s()+.-]+$/.test(String(value ?? ''))) return null;
  let digits = onlyDigits(value);
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
  if (!/^[2-9]\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) return null;
  return digits;
}

function isPhoneMx(value) {
  return normalizePhoneMx(value) !== null;
}

// Nombres y apellidos: solo letras (con acentos, ñ y ü), espacios, apóstrofo, punto y guion. Se colapsan los espacios
// repetidos. Devuelve el texto limpio o null si queda fuera de 2 a `max` caracteres o trae números o símbolos.
function normalizePersonName(value, max = 60) {
  const s = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > max) return null;
  if (!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(s) || !/\p{L}.*\p{L}/u.test(s)) return null;
  return s;
}

// Código postal mexicano: 5 dígitos.
function normalizeCp(value) {
  const cp = String(value ?? '').trim();
  return /^\d{5}$/.test(cp) ? cp : null;
}

// Cédula profesional de la SEP: 7 u 8 dígitos.
function normalizeCedula(value) {
  const cedula = String(value ?? '').trim();
  return /^\d{7,8}$/.test(cedula) ? cedula : null;
}

// Códigos de verificación de 6 dígitos: se aceptan con espacios o guion ("123 456").
function normalizeOtp(value) {
  const code = String(value ?? '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

module.exports = {
  isValidClabe, bankFromClabe, maskClabe, luhn, onlyDigits, BANKS,
  normalizeEmail, isEmail, isStrongPassword, normalizePhoneMx, isPhoneMx,
  normalizePersonName, normalizeCp, normalizeCedula, normalizeOtp,
};
