import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    // maplibre-gl is one ~1 MB chunk, loaded only on the SOS incident page
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // The map and Firebase are large and change rarely; keep them out of the app chunk
        manualChunks: { map: ['maplibre-gl'], firebase: ['firebase/app', 'firebase/auth'], react: ['react', 'react-dom', 'react-router'] },
      },
    },
  },
  test: { environment: 'jsdom' },
} as Parameters<typeof defineConfig>[0]);
