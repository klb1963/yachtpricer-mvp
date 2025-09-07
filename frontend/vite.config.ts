// frontend/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// важное: base оставляем `/`
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // чтобы слушал 0.0.0.0 в контейнере
    port: 3000,
    proxy: {
      // ВСЕ запросы /api/* на backend:8000
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // без переписывания пути, т.к. у бекенда префикс уже /api
      },
    },
  },
})