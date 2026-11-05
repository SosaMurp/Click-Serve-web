import { useEffect } from 'react'

const EVENTOS = ['mousedown', 'keydown', 'wheel', 'touchstart', 'visibilitychange'] as const

/**
 * Ejecuta `alVencer` tras `minutos` sin actividad (ratón, teclado, desplazamiento o tacto).
 * Cada pestaña tiene su propia sesión (sessionStorage), así que el conteo es por pestaña.
 */
export function useInactividad(minutos: number, alVencer: () => void) {
  useEffect(() => {
    if (!(minutos > 0)) return
    const limite = minutos * 60_000
    let ultima = Date.now()
    const marcar = () => { ultima = Date.now() }
    EVENTOS.forEach(e => window.addEventListener(e, marcar, { passive: true }))
    // Se revisa cada 15 s en vez de un solo temporizador: así cuenta también el tiempo con el equipo suspendido.
    const t = window.setInterval(() => {
      if (Date.now() - ultima >= limite) {
        window.clearInterval(t)
        alVencer()
      }
    }, 15_000)
    return () => {
      window.clearInterval(t)
      EVENTOS.forEach(e => window.removeEventListener(e, marcar))
    }
  }, [minutos, alVencer])
}
