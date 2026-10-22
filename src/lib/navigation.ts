import type { NavigateFunction } from 'react-router-dom'

/**
 * Referencia imperativa al navigate de React Router DOM.
 * Permite redirigir desde módulos fuera del árbol React (ej. interceptores de Axios).
 *
 * Se registra una sola vez desde App.tsx con `setNavigate(useNavigate())`.
 */
let _navigate: NavigateFunction | null = null

/** Registrar la función navigate del router activo (llamar desde App.tsx) */
export function setNavigate(nav: NavigateFunction) {
  _navigate = nav
}

/** Navegar imperativamente. Fallback a window.location si el router no está registrado. */
export function appNavigate(to: string, options?: { replace?: boolean }) {
  if (_navigate) {
    _navigate(to, options)
  } else {
    // Fallback de emergencia si el router aún no se montó
    if (options?.replace) {
      window.location.replace(to)
    } else {
      window.location.href = to
    }
  }
}
