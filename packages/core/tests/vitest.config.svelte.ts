import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  ssr: {
    noExternal: true,
  },
  test: {
    environment: 'jsdom', // Use jsdom for better DOM simulation
    include: ['src/**/*.svelte.test.ts'],
    reporters: 'default',
    globals: true,
    setupFiles: ['./src/setup/setup-svelte.ts'],
  },
});