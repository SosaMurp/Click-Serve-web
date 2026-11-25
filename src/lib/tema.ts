import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'oscuro'

const CLAVE = 'cs-tema'

/** Lo guardado por la persona; si nunca eligió, el modo de su sistema */
function inicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'claro' || guardado === 'oscuro') return guardado
  } catch { /* almacenamiento bloqueado: se usa el del sistema */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

let actual: Tema = inicial()
document.documentElement.dataset.tema = actual
const suscritos = new Set<() => void>()

export function setTema(t: Tema) {
  actual = t
  document.documentElement.dataset.tema = t
  try { localStorage.setItem(CLAVE, t) } catch { /* sin almacenamiento: dura hasta recargar */ }
  suscritos.forEach(f => f())
}

export function useTema(): Tema {
  return useSyncExternalStore(
    cb => { suscritos.add(cb); return () => { suscritos.delete(cb) } },
    () => actual,
  )
}
