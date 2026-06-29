import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  build: {
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: true,
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
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
      '/tennis': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
