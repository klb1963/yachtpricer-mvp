import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // Всё, что начинается с /api на фронте → уходит на backend
      '/api': {
        target: 'http://backend:8000', // имя сервиса из docker-compose
        changeOrigin: true,
        // rewrite убрали — backend сам ждёт /api/*
      },
    },
  },
})