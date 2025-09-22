# Components Gallery – Developing Sila components in isolation

This document explains how to use the `packages/gallery` SvelteKit site to build and test Sila UI components in isolation from the main app.

## Quick start

- Start the gallery:
  - From root: `npm run gallery`
- Open: `http://localhost:5173/`
- Links:
  - Home: basic links and examples
  - `/components/test-component`: minimal example
  - `/app`: runs the full app with a demo space (CityBean)

## Project layout

- `packages/gallery/` – SvelteKit app hosting the gallery
  - `src/routes/` – pages and demos
  - `src/lib/demo/buildSpaceFromConfig.ts` – builds an in-memory `Space` from a demo JSON
  - `src/routes/api/demo-space/+server.ts` – serves demo JSON to the gallery

## Using the full app in the gallery

For components that rely on global state (spaces, swins, theme, dialogs), the simplest path is to render the entire app and then navigate to the UI you want to work on.

- The gallery `/app` route:
  - Fetches `CityBean` JSON from `/api/demo-space`
  - Creates an in-memory `Space` via `buildSpaceFromConfig`
  - Injects the space into the global `clientState` singleton via `clientState.adoptInMemorySpace`
  - Renders `<SilaApp config={{}} />`
  - Uses client-only rendering (SSR disabled)

This gives a realistic environment without writing to disk or requiring any server.

Notes:
- `/app` sets `ssr = false` to avoid SSR importing browser-only modules.
- The gallery defaults `onboarding: false`, so the app opens directly without the setup wizard.
- The app requires compiled CSS from `@sila/client`. If styles are missing, run:
  - `npm run build -w @sila/client`

## Adding a new component demo page

1) Create a route under `packages/gallery/src/routes/components/<your-demo>/+page.svelte`.

2) For purely presentational components, import directly and pass minimal props:

```svelte
<script lang="ts">
  import MyComponent from '@sila/client/…/MyComponent.svelte';
</script>

<h2>MyComponent demo</h2>
<MyComponent someProp="value" />
```

3) For components that depend on app state or singletons (e.g., space, theme, swins), prefer to:
- Reuse the `/app` route and navigate to the UI inside the running app, or
- Create a client-only demo page that initializes the global context similarly to `/app`:

```ts
// +page.ts
export const ssr = false;
export const prerender = false;
```

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { SilaApp } from '@sila/client';
  import { clientState } from '@sila/client/state/clientState.svelte';
  import { buildSpaceFromConfig } from '$lib/demo/buildSpaceFromConfig';

  let ready = false;

  onMount(async () => {
    await clientState.init({});
    const cfg = await (await fetch('/api/demo-space')).json();
    const space = await buildSpaceFromConfig(cfg);
    await clientState.adoptInMemorySpace(space, cfg.name);
    ready = true;
  });
</script>

{#if ready}
  <SilaApp config={{}} />
{:else}
  Loading…
{/if}
```

This pattern establishes the minimum viable app context without persistence.

## Feeding data to demos

- The default demo JSON is `packages/demo/examples/citybean-coffee.json`.
- The gallery API at `/api/demo-space` imports and serves that JSON.
- You can point it to a different file or add multiple endpoints for different demos.
- `buildSpaceFromConfig` accepts the config and constructs all assistants, providers, and seed conversations.
- It also honors an optional `onboarding` boolean (default false in gallery).

## Working with singletons and app-wide stores

- `clientState` (singleton): central orchestrator for app state. In demos, call:
  - `await clientState.init({})` – bootstraps state and local DB
  - `await clientState.adoptInMemorySpace(space, name)` – adds a `Space` without persistence layers
  - Avoid calling `createSpace` or `loadSpace` in demos unless you explicitly want IndexedDB/file persistence

- Theme: managed by `ThemeManager` inside `SilaApp`; no extra setup needed in `/app` demos.

- Swins (stacking windows): initialized by `clientState.layout.swins` and rendered by `SwinsContainer` inside `SilaApp`.

- Local DB (Dexie): `clientState.init` touches IndexedDB, which is fine in browser. The in-memory space avoids writing app data to disk or FS.

- Files: file store provider is not set in memory-only mode. If your component needs file previews/uploads, consider adding a small mock API or extend the builder to attach a mock provider.

## Isolating a specific app component (e.g., ChatApp)

Options:
- Recommended: run the full app `/app` and navigate to Chat; edit the demo JSON to include the conversations/state you need.
- For deep isolation: render the component and supply its props and required stores manually. Inspect the component imports to see which stores/utilities it expects and mock them at the page level. This approach is advanced and can get brittle; prefer `/app` unless you truly need surgical isolation.

## Troubleshooting

- Vite dependency scan failure for deep imports (e.g., `@sila/core/utils/uuid`): avoid deep paths; use exported root APIs or local helpers.
- SSR errors: add `export const ssr = false;` to demo pages that rely on browser-only features (e.g., Dexie, window, CSSOM).
- Missing styles: run `npm run build -w @sila/client` to generate `compiled-style.css`.

## Future consolidation

- The builder logic used by the demo CLI (`packages/demo/src/simple-builder.ts`) and the gallery (`buildSpaceFromConfig.ts`) can be unified into a shared module that supports both in-memory and filesystem-backed spaces, minimizing duplication.
