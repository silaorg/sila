import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60_000 * 10,
    include: ['tests/src/**/*.test.ts'],
    reporters: 'default',
    globals: true,
    setupFiles: ['./tests/src/setup/setup-worker.ts']
  },
  worker: {
    // Configure worker to handle TypeScript
    format: 'es'
  }
});

