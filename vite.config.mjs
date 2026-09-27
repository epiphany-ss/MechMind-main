import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const fromRoot = (rel) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  root: fromRoot('./arcade-ui'),
  // 构建产物给 8080 的 /arcade.html 引用；开发时走 Vite 根路径。
  base: command === 'build' ? '/arcade-static/' : '/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/js': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/css': { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: fromRoot('./arcade-static'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'arcade-app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (info) => {
          const name = info.names?.[0] || info.name || ''
          if (name.endsWith('.css')) return 'arcade-app.css'
          return 'assets/[name][extname]'
        },
      },
    },
  },
}))
