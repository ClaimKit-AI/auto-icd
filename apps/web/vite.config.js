// ICD Suggest & Specifier Tray - Vite Configuration
// This configures the Vite build tool for our React frontend

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Development server configuration
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections (for Docker)
    open: false, // Don't auto-open browser
    cors: true
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true, // Include source maps for debugging
    minify: 'terser', // Minify for production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  },
  
  // Environment variables
  define: {
    // Make environment variables available to the app
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || 'http://localhost:3000')
  },
  
  // CSS configuration
  css: {
    postcss: './postcss.config.js'
  }
})

