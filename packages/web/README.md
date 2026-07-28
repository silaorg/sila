# Heswe Web - SvelteKit app

The Heswe SvelteKit server.

It serves the shared UI from `@heswe/client`, Better Auth routes, the workspace
API, and server-sent events.

## Dev

From the repository root:

```sh
npm run dev -w web
```

The server needs `WORKSPACES_PATH`. New accounts start with no workspace and
create one in the app. Production also needs `BETTER_AUTH_URL` and
`BETTER_AUTH_SECRET`. See
[how the hosted app works](../../docs/dev/how-the-hosted-app-works.md).

Check or build from the repository root:

```sh
npm run check -w web
npm run build -w web
```
