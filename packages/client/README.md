# Sila Client - Svelte

The client library for Sila. It provides shared UI and app logic for frontend packages such as `packages/web`, and later desktop or mobile wrappers.

Right now this package is intentionally small. We only move shared pieces here when we need them.

The CSS is built into `src/lib/compiled-style.css`.

## Dev

```sh
npm run dev -w @sila/client
```

## Build

```sh
npm run build -w @sila/client
```
