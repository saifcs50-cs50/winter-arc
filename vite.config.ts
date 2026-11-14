/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5193, proxy: { '/api': 'http://127.0.0.1:4747' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: { TZ: 'Asia/Riyadh' },
    coverage: {
      include: ['src/**', 'server/**'],
      exclude: ['src/**/*.test.*', 'server/**/*.test.*', 'src/test/**', 'src/main.tsx'],
    },
  },
})
