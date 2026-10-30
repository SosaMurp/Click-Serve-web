import React from 'react'
import { LogoMark } from '@components/ui/Logo'
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
            <LogoMark size={28} />
          </div>
          <div>
            <p className="auth-brand-name">Click &amp; Serve</p>
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
