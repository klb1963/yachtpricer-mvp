// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,                  // 0.0.0.0
    port: 3000,
    allowedHosts: ['sandbox.leonidk.de'], // <-- важно
  },
})