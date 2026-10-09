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
- `packages/desktop` contains the thin Electron shell for the shared client.

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

To launch the native desktop app, run `npm run dev:desktop`. It uses the same
client package and local API as the web app. Quit the desktop app to stop its
services. To launch a built client, run `npm run build:desktop` followed by
`npm run start:desktop`. See [desktop setup](packages/desktop/README.md).

Sign up and create a workspace. Automatic provider selection uses the built-in
Mock provider when no real provider is configured. It cycles through ten fixed
replies of different lengths in each thread, starting with `Hey!` and repeating
after reply ten. The cycle survives app restarts. Mock is available in every
build and can be selected in Workspace settings → Preferences.
Add a provider key in settings to use a real model.
Mock can also run real tools using a tool name and JSON inputs:

```text
tool: read_document
{"path":"notes.md"}
```

Put the command at the start of the message. Inputs must be a JSON object;
they can follow the tool name on the same line or the next line. The tool runs
once through the normal agent runtime, and Mock shows its result or error.
Tool commands do not advance the reply cycle.
Relative file paths start in the thread directory; use an absolute path for
other workspace files.
For development, you can also set a key such as `OPENAI_API_KEY` in the
server environment.
The workspace CLI remains available for standalone Slack and Telegram
workspaces.

Run `npm test` for tests and `npm run check -w web` for type checks.
Use Node 22.20 or later in the Node 22 line, matching the workspace image.
After changing Node versions, rebuild native dependencies with `npm rebuild`.
