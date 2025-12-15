import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@storyforge': path.resolve(__dirname, '..', 'storyforge.jsx')
    }
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: [path.resolve(__dirname, '..')]
    },
    proxy: {
      '/api': process.env.VITE_BACKEND_URL || 'http://localhost:8000',
      '/health': process.env.VITE_BACKEND_URL || 'http://localhost:8000'
    }
  }
})
