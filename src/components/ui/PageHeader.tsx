import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  sub?: string
  /** Acciones de la página (botones, selector de fechas…) alineadas a la derecha */
  children?: ReactNode
}

/** Encabezado común de las pantallas del panel: título, subtítulo y acciones. */
export default function PageHeader({ title, sub, children }: PageHeaderProps) {
  return (
    <header className="dash-page-header">
      <div>
        <h1 className="dash-page-title">{title}</h1>
        {sub && <p className="dash-page-sub">{sub}</p>}
      </div>
      {children && <div className="db-header-actions">{children}</div>}
    </header>
  )
}
