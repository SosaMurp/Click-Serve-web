/// <reference types="vite/client" />

/**
 * Tipado estricto de las variables de entorno expuestas por Vite.
 * Autocomplete + type-safety en import.meta.env
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_API_BASE_URL?: string
  readonly VITE_APP_NAME: string
  readonly VITE_SESSION_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
