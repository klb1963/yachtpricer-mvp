// frontend/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // слушать 0.0.0.0 в контейнере
    port: 3000,
    allowedHosts: ['sandbox.leonidk.de'], // <-- разрешаем домен (можно true, но лучше явно)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    // чтобы HMR работал через nginx/443
    hmr: {
      host: 'sandbox.leonidk.de',
      clientPort: 443,
      protocol: 'wss',   // TLS терминируется на nginx, к клиенту идём wss
    },
  },
})