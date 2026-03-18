import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir:    'dist',
    target:    'es2020',
    sourcemap: true,
  },
  define: {
    // Makes process.env available in SDK
    'process.env.MTWG_API_URL':
      JSON.stringify(process.env.MTWG_API_URL ?? 'http://localhost:3000'),
    'process.env.NODE_ENV':
      JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
})
