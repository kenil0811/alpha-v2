import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the window runs on Vite's server and reaches the core through this proxy;
// shipped, the core serves the built window itself.
const core = `http://127.0.0.1:${process.env.ALPHA_PORT ?? 4700}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4701,
    strictPort: true,
    proxy: {
      '/api': core,
      '/ws': { target: core, ws: true },
    },
  },
})
