import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0
  },
  server: {
    port: 3000
  }
});
