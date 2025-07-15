import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts'], // preserve directory structure
  dts: {
    compilerOptions: {
      declarationMap: true
    }
  },
  format: ['esm'],
  sourcemap: true,
  outDir: 'dist',
  clean: true,
  bundle: false,
  target: 'es2020'
}); 