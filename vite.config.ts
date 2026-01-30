import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      // Utilisation de @ pour pointer vers la racine du projet
      '@': path.resolve(__dirname, './src'), 
    }
  },
  build: {
    // Optimisation pour la production
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  }
});