import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src/react',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
      '/get-media-files': 'http://localhost:3000',
      '/filter-media': 'http://localhost:3000',
      '/rescan-directory': 'http://localhost:3000'
    }
  }
})
