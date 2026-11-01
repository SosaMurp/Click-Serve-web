// Validación en tiempo real (RNF-29). El servidor vuelve a validar todo; esto es retroalimentación inmediata.

const BANKS: Record<string, string> = {
  '002': 'BANAMEX', '006': 'BANCOMEXT', '009': 'BANOBRAS', '012': 'BBVA MÉXICO', '014': 'SANTANDER',
  '019': 'BANJÉRCITO', '021': 'HSBC', '030': 'BAJÍO', '036': 'INBURSA', '042': 'MIFEL', '044': 'SCOTIABANK',
  '058': 'BANREGIO', '059': 'INVEX', '060': 'BANSI', '062': 'AFIRME', '072': 'BANORTE', '106': 'BANK OF AMERICA',
  '113': 'VE POR MÁS', '127': 'BANCO AZTECA', '128': 'AUTOFIN', '130': 'COMPARTAMOS', '136': 'INTERCAM',
  '137': 'BANCOPPEL', '138': 'ABC CAPITAL', '140': 'CONSUBANCO', '143': 'CIBANCO', '145': 'BBASE',
  '147': 'BANKAOOL', '148': 'PAGATODO', '152': 'BANCREA', '154': 'BANCO COVALTO', '155': 'ICBC',
  '156': 'SABADELL', '157': 'SHINHAN', '158': 'MIZUHO', '166': 'BANCO DEL BIENESTAR', '638': 'NU MÉXICO',
  '646': 'STP', '722': 'MERCADO PAGO', '728': 'SPIN BY OXXO',
};

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidClabe(value: string): boolean {
  const clabe = onlyDigits(value);
  if (clabe.length !== 18) return false;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += (Number(clabe[i]) * weights[i % 3]) % 10;
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}

export function bankFromClabe(value: string): string | null {
  return BANKS[onlyDigits(value).slice(0, 3)] || null;
}

export function luhn(value: string): boolean {
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

export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'CARNET' | null;

export function cardBrand(value: string): CardBrand {
  const d = onlyDigits(value);
  if (/^4/.test(d)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^(506[2-9]|5064|6275)/.test(d)) return 'CARNET';
  return null;
}

export function formatCardNumber(value: string): string {
  const d = onlyDigits(value).slice(0, 19);
  if (cardBrand(d) === 'AMEX') return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function isExpiryValid(mmYY: string): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(mmYY ?? '').trim());
  if (!m) return false;
  const year = 2000 + Number(m[2]);
  const endOfMonth = new Date(year, Number(m[1]), 1);
  return endOfMonth > new Date();
}

export function passwordIssues(value: string): string[] {
  const s = String(value ?? '');
  const out: string[] = [];
  if (s.length < 8) out.push('8 caracteres');
  if (!/[A-Z]/.test(s)) out.push('una mayúscula');
  if (!/[a-z]/.test(s)) out.push('una minúscula');
  if (!/\d/.test(s)) out.push('un número');
  return out;
}

// Los formatos de abajo son los mismos que valida el backend (backend/src/lib/validators.js): al cambiar uno hay que
// cambiar el otro.

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

const EMAIL_LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DNS_TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

export function isEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (email.length > 254) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) return false;
  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split('.');
  if (local.length > 64 || !EMAIL_LOCAL.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return labels.length >= 2 && labels.every((l) => DNS_LABEL.test(l)) && DNS_TLD.test(labels[labels.length - 1]);
}

// Teléfono de México a 10 dígitos: acepta espacios, guiones, paréntesis y el prefijo +52 / 52 / 521.
export function normalizePhoneMx(value: string | null | undefined): string | null {
  if (!/^[\d\s()+.-]+$/.test(String(value ?? ''))) return null;
  let digits = onlyDigits(value);
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
  if (!/^[2-9]\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) return null;
  return digits;
}

export function isPhoneMx(value: string): boolean {
  return normalizePhoneMx(value) !== null;
}

// Lo que va quedando en el campo mientras se escribe o se pega: solo dígitos, sin el prefijo del país, máximo 10.
export function phoneDigitsFromInput(value: string | null | undefined): string {
  let digits = onlyDigits(String(value ?? '').trim());
  if (digits.length > 10) {
    if (digits.startsWith('521') && digits.length === 13) digits = digits.slice(3);
    else if (digits.startsWith('52') && digits.length === 12) digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}

// 7531234567 → "753 123 4567"
export function formatPhone(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
}

// Nombres y apellidos: letras, espacios, apóstrofo, punto y guion. Devuelve el texto limpio o null.
export function normalizePersonName(value: string | null | undefined, max = 60): string | null {
  const s = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > max) return null;
  if (!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(s) || !/\p{L}.*\p{L}/u.test(s)) return null;
  return s;
}

// Quita al escribir lo que no puede ir en un nombre (números y símbolos).
export function filterNameInput(value: string): string {
  return String(value ?? '').replace(/[^\p{L}\p{M}' .-]/gu, '').replace(/\s{2,}/g, ' ');
}
