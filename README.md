# Heswe

Heswe means healthy, smart, and wealthy. It is AI that does things for teams and businesses.

Heswe runs AI agents in workspaces on Linux servers. Agents can use the CLI and other tools to analyze data, check logs, review code, handle support tickets, and more. Users communicate with them through the hosted app, Slack, or Telegram.

Website: [heswe.com](https://heswe.com)

## Repository

- `packages/heswe` contains the workspace and agent runtime.
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

Use `npm run dev:api-only` when the dashboard entry point is not needed.

Sign up, then create and switch workspaces in the app. Set a language-provider
key such as `OPENAI_API_KEY` in the server process before sending messages.
The workspace CLI remains available for standalone Slack and Telegram
workspaces.
