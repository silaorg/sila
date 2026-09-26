# Heswe Web - SvelteKit app

The Heswe SvelteKit server.

It serves the shared UI from `@heswe/client`, Better Auth routes, the workspace
API, and server-sent events.

## Dev

From the repository root:

```sh
npm run dev
```

The repository launcher assigns an API-first port pair. The SvelteKit server
uses the even API port and an optional dashboard proxy uses the following odd
port. Run `npm run dev -w web` only when starting the SvelteKit API process
directly without the repository launcher.

The repository launcher defaults local workspace and authentication storage to
`.data/`. Direct and production server launches need `WORKSPACES_PATH`.
New accounts start with no workspace and create one in the app. Production also
needs `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. See
[how the hosted app works](../../docs/dev/how-the-hosted-app-works.md).

Check or build from the repository root:

```sh
npm run check -w web
npm run build -w web
```
