# Heswe

Heswe runs AI agents in workspaces on a Linux server. You can use them from the web app, Slack, or Telegram.

Agents can work with files, run commands, and use tools. A workspace keeps its conversations, files, instructions, and skills in one directory. You can back it up or move it to another server.

[Website](https://heswe.com)

## Run locally

Use Node.js 22.20 or later.

```sh
git submodule update --init --recursive
npm ci
npm run dev
```

Open the dashboard URL printed in the terminal. It usually starts at `http://127.0.0.1:39901`.

Create an account and a workspace. Open workspace settings and connect a model provider. Then start a conversation.

Local data lives in `.data/`. Run `npm run dev:ports` to find a running instance.

## Code

- `packages/heswe`: workspaces, files, channels, and agent runtime
- `packages/agents`: workers and sandbox launchers
- `packages/client`: shared Svelte UI
- `packages/web`: web server, accounts, and API
- `vendor/aiwrapper`: AIWrapper submodule, including the AIModels submodule

We're on version `2.0.0`, on the `v2` branch. `main` still has Sila 1.

## Docs

- [Status and what's left](docs/dev/status.md)
- [Code review and follow-up work](docs/dev/review-2026-09-26.md)
- [Workspaces](docs/workspace.md), [agents](docs/agents.md), [skills](docs/skills.md), and [tools](docs/tools.md)
- [How workspaces work](docs/dev/how-workspaces-work.md)
- [How agents work](docs/dev/how-agents-work.md)
- [Run the hosted app](docs/dev/how-the-hosted-app-works.md)
- [Work on AIWrapper and AIModels](docs/dev/dependencies.md)
