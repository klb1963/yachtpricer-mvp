// frontend/vite.config.prod.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: ['sandbox.leonidk.de'],
    proxy: {
      // внутри docker-сети на VPS backend доступен по имени сервиса
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    // если когда-то будешь гонять Vite dev-сервер за reverse-proxy:
    hmr: {
      host: 'sandbox.leonidk.de',
      clientPort: 443,
      protocol: 'wss',
    },
  },
})