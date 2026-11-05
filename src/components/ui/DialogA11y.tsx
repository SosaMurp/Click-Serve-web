import { useEffect } from 'react'

// Accesibilidad común a todos los modales del panel (.modal-container), sin tocar cada uno:
// - role="dialog", aria-modal y aria-labelledby con su .modal-title
// - el foco entra al abrir, no sale con Tab mientras está abierto y regresa al cerrar
// - Escape cierra el modal de encima con su botón .modal-close-btn
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let contador = 0

function prepararDialogo(el: HTMLElement) {
  if (el.dataset.a11y) return
  el.dataset.a11y = '1'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.tabIndex = -1
  const titulo = el.querySelector<HTMLElement>('.modal-title')
  if (titulo) {
    if (!titulo.id) titulo.id = `modal-titulo-${++contador}`
    el.setAttribute('aria-labelledby', titulo.id)
  }
  el.querySelectorAll<HTMLElement>('.modal-close-btn').forEach(b => {
    if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Cerrar')
  })
  const previo = document.activeElement as HTMLElement | null
  ;(el as HTMLElement & { _focoPrevio?: HTMLElement | null })._focoPrevio = previo
  const primero = el.querySelector<HTMLElement>('[autofocus]') ?? el.querySelector<HTMLElement>(`.modal-body ${FOCUSABLE}`) ?? el
  primero.focus({ preventScroll: true })
}

const abiertos = () => Array.from(document.querySelectorAll<HTMLElement>('.modal-container'))

export function DialogA11y() {
  useEffect(() => {
    let previos = new Set<HTMLElement>()
    const revisar = () => {
      const actuales = new Set(abiertos())
      actuales.forEach(el => { if (!previos.has(el)) prepararDialogo(el) })
      previos.forEach(el => {
        if (!actuales.has(el)) {
          const foco = (el as HTMLElement & { _focoPrevio?: HTMLElement | null })._focoPrevio
          if (foco?.isConnected) foco.focus({ preventScroll: true })
        }
      })
      previos = actuales
    }
    const observer = new MutationObserver(revisar)
    observer.observe(document.body, { childList: true, subtree: true })

    const onKey = (e: KeyboardEvent) => {
      const lista = abiertos()
      const arriba = lista[lista.length - 1]
      if (!arriba) return
      if (e.key === 'Escape') {
        const cerrar = arriba.querySelector<HTMLButtonElement>('.modal-close-btn')
        if (cerrar && !cerrar.disabled) { e.preventDefault(); cerrar.click() }
        return
      }
      if (e.key !== 'Tab') return
      const focos = Array.from(arriba.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null)
      if (focos.length === 0) { e.preventDefault(); arriba.focus(); return }
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      const activo = document.activeElement as HTMLElement | null
      if (!activo || !arriba.contains(activo)) { e.preventDefault(); primero.focus(); return }
      if (e.shiftKey && activo === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { observer.disconnect(); document.removeEventListener('keydown', onKey) }
  }, [])
  return null
}
