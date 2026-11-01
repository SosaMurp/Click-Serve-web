// Formatos de los datos que se capturan en el panel. Son los mismos que valida el backend
// (backend/src/lib/validators.js) y que usa la app móvil (movil/src/lib/validators.ts): al cambiar uno hay que
// cambiar los otros.

const soloDigitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')

export const normalizarCorreo = (v: string | null | undefined) => String(v ?? '').trim().toLowerCase()

const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/
const ETIQUETA_DNS = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/

export function correoValido(v: string): boolean {
  const correo = normalizarCorreo(v)
  if (correo.length > 254) return false
  const at = correo.lastIndexOf('@')
  if (at < 1 || correo.indexOf('@') !== at) return false
  const local = correo.slice(0, at)
  const etiquetas = correo.slice(at + 1).split('.')
  if (local.length > 64 || !LOCAL.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  return etiquetas.length >= 2 && etiquetas.every(e => ETIQUETA_DNS.test(e)) && TLD.test(etiquetas[etiquetas.length - 1])
}

// Teléfono de México a 10 dígitos; acepta espacios, guiones, paréntesis y el prefijo +52 / 52 / 521.
export function normalizarTelefono(v: string | null | undefined): string | null {
  if (!/^[\d\s()+.-]+$/.test(String(v ?? ''))) return null
  let digitos = soloDigitos(v)
  if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3)
  else if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2)
  if (!/^[2-9]\d{9}$/.test(digitos) || /^(\d)\1{9}$/.test(digitos)) return null
  return digitos
}

// 7531234567 → "753 123 4567"; si no tiene 10 dígitos se deja como está.
export function formatearTelefono(v: string | null | undefined): string {
  const d = soloDigitos(v)
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(v ?? '')
}

export function nombreValido(v: string | null | undefined, max = 60): string | null {
  const s = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  if (s.length < 2 || s.length > max) return null
  if (!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(s) || !/\p{L}.*\p{L}/u.test(s)) return null
  return s
}

export function contrasenaFuerte(v: string): boolean {
  return v.length >= 8 && v.length <= 64 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)
}
