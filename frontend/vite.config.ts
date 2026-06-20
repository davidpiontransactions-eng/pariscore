import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  server: {
    proxy: {
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/predict': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/features': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/strategy': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
