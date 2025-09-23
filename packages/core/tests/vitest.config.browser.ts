import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom', // or 'jsdom' for more complete DOM simulation
    include: ['src/**/*.browser.test.ts'],
    reporters: 'default',
    globals: true,
    setupFiles: ['./src/setup-browser.ts'],
  },
});