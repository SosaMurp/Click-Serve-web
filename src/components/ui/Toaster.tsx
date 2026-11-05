import { create } from 'zustand'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

// Avisos breves en pantalla en lugar de alert(): no bloquean la interfaz y se leen con lector de pantalla.
type Tono = 'success' | 'error' | 'info'
interface Aviso { id: number; tono: Tono; texto: string }

interface ToastState {
  avisos: Aviso[]
  mostrar: (tono: Tono, texto: string) => void
  quitar: (id: number) => void
}

let siguiente = 1
const useToasts = create<ToastState>((set, get) => ({
  avisos: [],
  mostrar: (tono, texto) => {
    const id = siguiente++
    set({ avisos: [...get().avisos.slice(-3), { id, tono, texto }] })
    window.setTimeout(() => get().quitar(id), tono === 'error' ? 7000 : 4500)
  },
  quitar: (id) => set({ avisos: get().avisos.filter(a => a.id !== id) }),
}))

export const toast = {
  success: (texto: string) => useToasts.getState().mostrar('success', texto),
  error: (texto: string) => useToasts.getState().mostrar('error', texto),
  info: (texto: string) => useToasts.getState().mostrar('info', texto),
}

const ICONO = { success: <CheckCircle2 size={16} />, error: <AlertTriangle size={16} />, info: <Info size={16} /> }

export function Toaster() {
  const { avisos, quitar } = useToasts()
  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {avisos.map(a => (
        <div key={a.id} className={`toast toast--${a.tono}`} role={a.tono === 'error' ? 'alert' : 'status'}>
          {ICONO[a.tono]}
          <span className="toast-text">{a.texto}</span>
          <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => quitar(a.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
