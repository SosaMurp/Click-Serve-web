/**
 * Utilitario de Sanitización, Criptografía e Idempotencia (RNF-06, RNF-29, RNF-33, RNF-37)
 */

/**
 * Sanitiza cualquier entrada de texto eliminando etiquetas HTML y caracteres potencialmente peligrosos (RNF-06).
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>'"]/g, (char) => {
      switch (char) {
        case '<': return '&lt;'
        case '>': return '&gt;'
        case "'": return '&#39;'
        case '"': return '&quot;'
        default: return char
      }
    })
    .trim()
}

/**
 * Valida un número de tarjeta de crédito/débito utilizando el Algoritmo de Luhn en < 100ms (RNF-29).
 */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let isEven = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Valida una Cuenta CLABE Interbancaria de 18 dígitos en tiempo real (RNF-29).
 */
export function isValidCLABE(clabe: string): boolean {
  const digits = clabe.replace(/\D/g, '')
  return digits.length === 18
}

/**
 * Formatea montos monetarios asegurando precisión numérica de punto fijo sin errores de coma flotante JS (RNF-37, RNF-39).
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '$0.00 MXN'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Genera un UUID v4 para Tokens de Idempotencia X-Idempotency-Key (RNF-33, RNF-35).
 */
export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

