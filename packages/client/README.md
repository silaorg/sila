# Heswe Client - Svelte

The shared Svelte UI and typed HTTP client for Heswe frontends.

It contains authentication screens, the workspace interface, and the
same-origin API client used by `packages/web`. HTTP requests live in
`api-client.ts`; live updates and their connection lifecycle live in
`workspace-events.ts`. Tailwind builds
`src/lib/compiled-style.css`.

## Dev

```sh
npm run dev -w @heswe/client
```

Check or build from the repository root:

```sh
npm run check -w @heswe/client
npm run build -w @heswe/client
```
