import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting library (heavy)
          'vendor-charts': ['recharts'],
          // Drag and drop (moderately heavy)
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          // Animation library
          'vendor-animation': ['framer-motion'],
          // React Query
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 600,
  },
}));
