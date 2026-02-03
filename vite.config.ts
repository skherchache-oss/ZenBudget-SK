import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [react()],
  root: './',
  // Ajout pour stabiliser les librairies qui cherchent des variables globales Node
  define: {
    'global': 'window',
  },
  optimizeDeps: {
    // Force Vite à pré-bundler Google GenAI pour éviter les erreurs d'externalisation
    include: ['@google/genai'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Vide le dossier dist avant chaque build
    sourcemap: false,   // Allège le build pour Vercel
    rollupOptions: {
      input: './index.html',
      output: {
        // Force un hashage propre pour éviter les conflits de cache
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
});