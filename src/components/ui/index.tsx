import React from 'react'
import './ui.css'

/* ── Button ── */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary', size = 'md', loading, fullWidth,
  children, disabled, className = '', ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${fullWidth ? 'btn--full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn-spinner" /> : children}
    </button>
  )
}

/* ── Input ── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  iconRight?: React.ReactNode
  iconLeft?: React.ReactNode
  suffix?: string
}

export function Input({ label, error, hint, iconRight, iconLeft, suffix, className = '', id, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && <label className="field-label" htmlFor={inputId}>{label}</label>}
      <div className="field-wrap">
        {iconLeft && <span className="field-icon field-icon--left">{iconLeft}</span>}
        <input id={inputId} className={`field-input ${iconLeft ? 'pl-icon' : ''} ${iconRight || suffix ? 'pr-icon' : ''}`} {...rest} />
        {suffix && <span className="field-suffix">{suffix}</span>}
        {iconRight && <span className="field-icon field-icon--right">{iconRight}</span>}
      </div>
      {error && <p className="field-msg field-msg--error">{error}</p>}
      {hint && !error && <p className="field-msg">{hint}</p>}
    </div>
  )
}

/* ── Badge ── */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'online'
interface BadgeProps { variant?: BadgeVariant; children: React.ReactNode; dot?: boolean }

export function Badge({ variant = 'neutral', dot, children }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

/* ── StatCard ── */
interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  change?: string
  changePositive?: boolean
  alert?: boolean
}

export function StatCard({ label, value, icon, change, changePositive = true, alert }: StatCardProps) {
  return (
    <div className={`stat-card ${alert ? 'stat-card--alert' : ''}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {change && (
          <p className={`stat-change ${changePositive ? 'pos' : 'neg'}`}>{change}</p>
        )}
      </div>
    </div>
  )
}
