import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '@api': resolve(import.meta.dirname, './src/api'),
      '@components': resolve(import.meta.dirname, './src/components'),
      '@pages': resolve(import.meta.dirname, './src/pages'),
      '@hooks': resolve(import.meta.dirname, './src/hooks'),
      '@store': resolve(import.meta.dirname, './src/store'),
      '@types': resolve(import.meta.dirname, './src/types'),
      '@utils': resolve(import.meta.dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Backend único (backend/): lo usan el panel y la app móvil
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
