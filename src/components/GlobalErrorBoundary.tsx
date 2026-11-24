import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: '3rem 2rem', background: 'var(--bg-page)', minHeight: '100vh', color: 'var(--text-dark)', maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo falló en el panel</h1>
          <p style={{ color: 'var(--text-mid)', marginBottom: 20 }}>Recarga la página para continuar. Si vuelve a pasar, avisa al equipo técnico con lo que estabas haciendo.</p>
          <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>Recargar</button>
          {import.meta.env.DEV && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: 24, fontFamily: 'monospace', fontSize: 12, color: 'var(--danger-ink)' }}>
              <summary>{this.state.error?.toString()}</summary>
              {this.state.errorInfo?.componentStack}
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
