import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './config/queryClient'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'
import './index.css'
// Rediseño de prueba: sus reglas llevan `html` delante para ganar a las de cada página sin importar el orden de carga
import './tema-moderno.css'
import './lib/tema'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
)
