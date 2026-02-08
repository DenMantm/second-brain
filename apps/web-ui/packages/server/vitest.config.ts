import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // 15 seconds for integration tests with real API calls
    hookTimeout: 15000, // 15 seconds for setup/teardown hooks
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.ts'
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
