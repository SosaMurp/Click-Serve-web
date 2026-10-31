import { z } from 'zod/v4'

/**
 * Esquema Zod para validación estricta de variables de entorno en tiempo de arranque.
 * Cualquier variable faltante o con formato inválido detendrá la app de inmediato
 * con un mensaje de error descriptivo en consola.
 *
 * Variables esperadas en .env.local:
 *   VITE_API_BASE_URL     → Base path o URL completa del backend (obligatoria, ej. "/api" o "http://localhost:3000/api")
 *   VITE_APP_API_BASE_URL → URL del backend de la app móvil (opcional, default: "/app-api/api")
 *   VITE_APP_NAME         → Nombre de la app para metadatos (opcional, default: "Click&Serve Admin")
 *   VITE_SESSION_TIMEOUT  → Minutos de inactividad antes de cerrar sesión (opcional, default: 30)
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .min(1, 'VITE_API_BASE_URL es obligatoria (ej. "/api" o "http://localhost:3000/api")'),

  // Backend de la app móvil (Click-Serve-Back). Por defecto, el proxy de Vite en /app-api.
  VITE_APP_API_BASE_URL: z
    .string()
    .default('/app-api/api'),

  VITE_APP_NAME: z
    .string()
    .default('Click&Serve Admin'),

  VITE_SESSION_TIMEOUT: z
    .string()
    .default('30')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
})

export type EnvConfig = z.infer<typeof envSchema>

function validateEnv(): EnvConfig {
  const raw = import.meta.env
  const result = envSchema.safeParse(raw)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    console.error(
      '\n🚨 ══════════════════════════════════════════════════════════════\n' +
      '   ERROR CRÍTICO: Variables de entorno inválidas o faltantes\n' +
      '══════════════════════════════════════════════════════════════\n\n' +
      issues + '\n\n' +
      '📄 Crea un archivo .env.local en la raíz del proyecto con:\n\n' +
      '   VITE_API_BASE_URL=/api\n' +
      '   VITE_APP_NAME=Click&Serve Admin\n' +
      '   VITE_SESSION_TIMEOUT=30\n\n' +
      '══════════════════════════════════════════════════════════════\n'
    )

    throw new Error('Variables de entorno inválidas. Revisa la consola para más detalles.')
  }

  return result.data
}

/** Configuración de entorno validada y tipada — se evalúa una sola vez al importar */
export const env = validateEnv()
