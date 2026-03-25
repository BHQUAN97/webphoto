import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    allowedHosts: ['bhquan.site'],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        // Preserve original Host header (bhquan.site vs localhost)
        // so backend can detect secure cookies correctly
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the original Host from the client request
            if (req.headers.host) {
              proxyReq.setHeader('Host', req.headers.host)
            }
          })
        },
      },
    },
  },
})
