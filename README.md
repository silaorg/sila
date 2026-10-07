# Heswe

Heswe runs AI agents that work with files, tools, and shell commands.
You can use them through the web app, Slack, or Telegram.

A workspace is a directory with conversations, files, instructions, skills,
tools, and provider settings. You can back it up or move it together.
Each workspace has its own model settings and API keys.

Website: [heswe.com](https://heswe.com)

## Repository

- `packages/agents` contains the agent process client and worker entry point.
- `packages/heswe` contains workspace configuration, storage, channels, and
  the current agent runtime implementation.
- `packages/client` contains the shared Svelte UI and API client.
- `packages/web` contains the SvelteKit server, authentication, and web routes.

Read [how workspaces work](docs/dev/how-workspaces-work.md), [how agents work](docs/dev/how-agents-work.md), and [how the hosted app works](docs/dev/how-the-hosted-app-works.md).

To run the hosted app locally:

```sh
npm install
npm run dev
```

The first instance uses `http://127.0.0.1:39900` for the API and
`http://127.0.0.1:39901` for the dashboard. If either port is busy, the
launcher tries the next pair: `39902/39903`, then `39904/39905`, and so on.
Run `npm run dev:ports` to rediscover the URLs for this checkout.

Local workspaces and authentication data default to `.data/`.
Agents start as Node child processes on this machine when needed.
Local development needs no Docker, VM, or cloud account. Agents have the same
filesystem permissions as the user running the server.

Use `npm run dev:api-only` when the dashboard entry point is not needed.

Sign up, create a workspace, and add a provider key in its settings.
For development, you can also set a key such as `OPENAI_API_KEY` in the
server environment.
The workspace CLI remains available for standalone Slack and Telegram
workspaces.

Run `npm test` for tests and `npm run check -w web` for type checks.
Use Node 22.20 or later in the Node 22 line, matching the workspace image.
After changing Node versions, rebuild native dependencies with `npm rebuild`.
