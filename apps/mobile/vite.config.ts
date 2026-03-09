import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sanbao/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@sanbao/stores': path.resolve(__dirname, '../../packages/stores/src'),
      '@sanbao/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          /* React core — изменяется редко, кешируется долго */
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          /* UI библиотеки — анимации и иконки */
          'ui-vendor': [
            'framer-motion',
            'lucide-react',
          ],
          /* Capacitor runtime — нативный мост */
          'capacitor': [
            '@capacitor/app',
            '@capacitor/core',
            '@capacitor/splash-screen',
            '@capacitor/preferences',
            '@capacitor/haptics',
          ],
        },
      },
    },
  },
})
