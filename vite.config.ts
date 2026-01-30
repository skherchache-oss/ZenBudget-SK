import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Port standard pour le développement
  server: {
    port: 3000,
  },
  plugins: [react()],
  // On indique que la racine est le dossier actuel
  root: './',
  build: {
    outDir: 'dist',
    // On s'assure que l'index.html est bien le point d'entrée
    rollupOptions: {
      input: './index.html',
    },
  },
});