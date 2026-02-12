import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'util': 'util/',
    },
    dedupe: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-data',
      '@tensorflow/tfjs-layers',
    ],
  },
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-data',
      '@tensorflow/tfjs-layers',
      '@tensorflow-models/speech-commands',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3030',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'tensorflow': [
            '@tensorflow/tfjs',
            '@tensorflow/tfjs-core',
            '@tensorflow/tfjs-backend-cpu',
            '@tensorflow/tfjs-backend-webgl',
            '@tensorflow/tfjs-converter',
            '@tensorflow/tfjs-data',
            '@tensorflow/tfjs-layers',
          ],
          'tensorflow-models': ['@tensorflow-models/speech-commands'],
        },
      },
    },
  },
});
