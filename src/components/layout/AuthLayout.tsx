import React from 'react'
import './auth-layout.css'

interface AuthLayoutProps {
  leftTitle: React.ReactNode
  leftSubtitle?: string
  leftDescription?: string
  nodeLabel?: string
  children: React.ReactNode
}

export default function AuthLayout({
  leftTitle, leftSubtitle, leftDescription,
  nodeLabel = 'Panel de administración',
  children
}: AuthLayoutProps) {
  return (
    <div className="auth-root">
      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <header className="auth-brand">
          <div className="auth-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="auth-brand-name">Click&amp;Serve</p>
            <p className="auth-brand-node">{nodeLabel}</p>
          </div>
        </header>

        <div className="auth-left-content">
          {leftSubtitle && <p className="auth-left-subtitle">{leftSubtitle}</p>}
          <h1 className="auth-left-title">{leftTitle}</h1>
          {leftDescription && <p className="auth-left-desc">{leftDescription}</p>}
        </div>

        <footer className="auth-left-footer">
          <p className="auth-footer-tag">Acceso restringido a personal autorizado.</p>
        </footer>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-right-inner fade-in">
          {children}
        </div>
      </div>
    </div>
  )
}
