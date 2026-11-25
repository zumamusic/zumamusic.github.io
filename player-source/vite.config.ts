import { defineConfig } from 'vite';
import webampEdges from './webamp-edge-plugin.mjs';

export default defineConfig({
  base: '/player/',
  plugins: [webampEdges()],
  build: { outDir: '../dist/player', emptyOutDir: true },
});
