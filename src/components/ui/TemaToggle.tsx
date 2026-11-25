import { Moon, Sun } from 'lucide-react'
import { setTema, useTema } from '@/lib/tema'

/** Botón para pasar entre modo claro y modo oscuro */
export default function TemaToggle({ className = '' }: { className?: string }) {
  const tema = useTema()
  const oscuro = tema === 'oscuro'
  const destino = oscuro ? 'claro' : 'oscuro'
  return (
    <button type="button" className={`mx-tema ${className}`} onClick={() => setTema(destino)}
      aria-label={`Cambiar a modo ${destino}`} title={`Cambiar a modo ${destino}`}>
      <span className={`mx-tema-ico ${oscuro ? '' : 'mx-tema-ico--on'}`} aria-hidden><Sun size={15} /></span>
      <span className={`mx-tema-ico ${oscuro ? 'mx-tema-ico--on' : ''}`} aria-hidden><Moon size={15} /></span>
    </button>
  )
}
