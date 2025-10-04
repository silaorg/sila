## Proposal: Move `src-electron` to TypeScript

### Objective
Adopt TypeScript for Electron main-process code in `packages/desktop/src-electron` with minimal tooling changes, keeping imports from `@sila/core` working and preserving current dev/build workflows.

### Context
- Desktop app uses Vite for the renderer (`packages/desktop/vite.config.js`) and Electron Builder for packaging.
- Electron entry is `src-electron/main-electron.js` (ESM). We import `@sila/core` which ships TypeScript.

### Approach
Use Vite with `vite-plugin-electron` for the main process. This keeps a single toolchain for renderer + main, auto-restarts Electron in dev, transpiles TS, bundles `@sila/core`, and keeps native deps external.

### High-level changes
1) Rename main-process files to `.ts` (e.g., `src-electron/main-electron.ts`).
2) Add `vite-plugin-electron` to the renderer Vite config to build/watch the main process.
3) Output bundled main to `dist-electron/main-electron.js` and set `package.json` `main` accordingly.
4) Ensure `electron` and `electron-updater` are external; bundle `@sila/core`.
5) Include `dist-electron/**` in Electron Builder `build.files`.

### Minimal config
Add the plugin and configure main build:

```ts
// packages/desktop/vite.config.js (augment existing config)
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    svelte(),
    electron({
      main: {
        entry: 'src-electron/main-electron.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            target: 'node20',
            sourcemap: true,
            rollupOptions: {
              external: ['electron', 'electron-updater']
            }
          }
        }
      }
    })
  ],
  base: './',
  publicDir: 'static-compiled',
  build: { outDir: 'build', target: 'chrome120', sourcemap: true, cssMinify: false, assetsDir: 'assets' },
  define: { global: 'globalThis' }
})
```

`package.json` (desktop) adjustments:

```json
{
  "main": "dist-electron/main-electron.js",
  "build": {
    "files": [
      "dist-electron/**",
      { "from": "build", "to": "" }
    ]
  }
}
```

TypeScript types for main (optional but helpful):

```json
// packages/desktop/tsconfig.electron.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "electron"],
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src-electron/**/*.ts"]
}
```

Notes:
- Keep ESM imports and `.js` extensions in relative paths as today; Vite handles resolution.
- `@sila/core` will be bundled automatically; no changes needed in the core package.

### Migration steps
1) Install dependency: `npm i -w @sila/desktop -D vite-plugin-electron`.
2) Rename `src-electron/*.js` to `.ts` and fix any type errors.
3) Update `vite.config.js` as above; keep `electron` and `electron-updater` external.
4) Set `package.json` `main` to `dist-electron/main-electron.js`; include `dist-electron/**` in `build.files`.
5) Optional: add `tsconfig.electron.json` and a `check:electron` script.
6) Dev: run `npm run dev` (Electron launches automatically). Build: `npm run build` then package.

### Risks & mitigations
- **Native modules resolution**: kept external; resolved at runtime by Electron.
- **Code signing/notarization**: unchanged; dist path updated only.
- **Source maps**: enabled for main and renderer for debugging.


