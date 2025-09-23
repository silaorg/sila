# Components Gallery – Developing Sila components in isolation

This document explains how to use the `packages/gallery` SvelteKit site to build and test Sila UI components in isolation from the main app.

## Quick start

- Start the gallery:
  - From root: `npm run gallery`
- Open: `http://localhost:5173/`
- Links:
  - Home: basic links and examples
  - `/components/chat-sandbox`: Chat app demo in isolation
  - `/app`: runs the full app with a demo space (CityBean)

## Project layout

- `packages/gallery/` – SvelteKit app hosting the gallery
  - `src/routes/` – pages and demos
  - `src/lib/demo/buildSpaceFromConfig.ts` – builds an in-memory `Space` from a demo JSON
  - `src/routes/api/demo-space/+server.ts` – serves demo JSON to the gallery

## Using the full app in the gallery

For components that rely on global state (spaces, swins, theme, dialogs), the simplest path is to render the entire app and then navigate to the UI you want to work on.

The gallery `/app` route uses a helper component that loads a demo space and renders the full app:

```svelte
<script lang="ts">
  import GallerySilaApp from '$lib/GallerySilaApp.svelte';
</script>

<GallerySilaApp />
```

- Fetches `CityBean` JSON from `/api/demo-space`
- Builds an in-memory `Space` and adopts it
- Renders `<SilaApp config={{}} />`
- Uses client-only rendering (SSR disabled)

This gives a realistic environment without writing to disk or requiring any server.

Notes:
- `/app` sets `ssr = false` to avoid SSR importing browser-only modules.
- The gallery defaults `onboarding: false`, so the app opens directly without the setup wizard.
- Styles from `@sila/client/compiled-style.css` are imported globally in the gallery root layout. If styles are missing, ensure the layout import exists and (if needed) run `npm run build -w @sila/client` to generate the CSS.

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
  import GallerySilaApp from '$lib/GallerySilaApp.svelte';
</script>

<GallerySilaApp />
```

This pattern establishes the minimum viable app context without persistence.

### Gallery helpers (recommended)

- Use `GallerySilaApp` to run the full app against a demo space.
- To render Chat in isolation, use the built-in demo component:

```svelte
<script lang="ts">
  import ChatAppInGallery from '$lib/comps/ChatAppInGallery.svelte';
</script>

<ChatAppInGallery />
```

## Feeding data to demos

- The default demo JSON is `packages/demo/examples/citybean-coffee.json`.
- The gallery API at `/api/demo-space` imports and serves that JSON.
- You can point it to a different file or add multiple endpoints for different demos.
- `buildSpaceFromConfig` accepts the config and constructs all assistants, providers, and seed conversations.
- It also honors an optional `onboarding` boolean (default false in gallery).

## Working with app state in gallery

- `galleryState`: small helper that loads an in-memory demo `Space` once per URL and exposes readiness and the current `Space`.
  - `await galleryState.loadSpace('/api/demo-space')`
  - `galleryState.currentSpace` → the active space
  - Used by both `GallerySilaApp` and `ChatAppInGallery`

- Files: file store provider is not set in memory-only mode. If your component needs file previews/uploads, consider adding a small mock API or extend the builder to attach a mock provider.

## Isolating a specific app component (e.g., ChatApp)

Options:
- Recommended: run the full app `/app` and navigate to Chat; or use `ChatAppInGallery`.
- For deep isolation: render the component and supply its props and required stores manually. This can be brittle; prefer the helpers above.

## Testing

We use Playwright for end-to-end testing of components and pages in the gallery.

## Troubleshooting

- Vite dependency scan failure for deep imports (e.g., `@sila/core/utils/uuid`): avoid deep paths; use exported root APIs or local helpers.
- SSR errors: add `export const ssr = false;` to demo pages that rely on browser-only features (e.g., Dexie, window, CSSOM).
- Missing styles: run `npm run build -w @sila/client` to generate `compiled-style.css`.

## Future consolidation

- The builder logic used by the demo CLI (`packages/demo/src/simple-builder.ts`) and the gallery (`buildSpaceFromConfig.ts`) can be unified into a shared module that supports both in-memory and filesystem-backed spaces, minimizing duplication.
