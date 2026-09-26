# Sila 2

Version 2.0.0 is the hosted successor to Sila's local-first desktop app.
Development continues on `v2`; `main` retains the Sila 1 codebase.

Sila gives you and your team AI agents and portable workspaces you control.
It feels familiar if you have used ChatGPT, but its agents can work with your
files and tools, not just reply in a chat. Ask them to research, analyze data,
check logs, review code, create documents, handle support work, or take on
another task from start to finish.

Everything is organized into workspaces. A workspace keeps conversations,
shared files, agent instructions, skills, tools, and results together for a
team, project, or part of your life. It is stored as an ordinary directory, so
it can be backed up or moved as a unit.

The more you work with AI, the more valuable its context and output become.
Sila keeps that growing body of work together instead of scattering it across
disposable chats. Run a workspace on a Linux server and reach its agents
through the web app, Slack, or Telegram.

Website: [silain.com](https://silain.com)

## Features

### Agents that do the work

Sila agents can read and create files, run commands, use workspace tools, and
report progress while they work. Skills give them reusable knowledge and
workflows for recurring tasks.

### Conversations and files together

Attach files to a thread or keep shared material in workspace folders. Mention
a workspace file in a message, ask an agent to use it, and keep the result in
the same workspace for future work.

### Separate workspaces

Keep different teams, projects, or parts of your life in separate workspaces.
Each workspace has its own conversations, files, agents, tools, and provider
settings.

### Your choice of AI

Connect model providers with your own keys and choose the model that fits the
work. Sila is not tied to a single AI company.

### Available where your team works

Use Sila in the hosted app, Slack, or Telegram. Threads share the same
workspace while remaining separate conversations.

## Repository

- `packages/agents` contains the agent process client and worker entry point.
- `packages/sila` contains workspace configuration, storage, channels, and
  the current agent runtime implementation.
- `packages/client` contains the shared Svelte UI and API client.
- `packages/web` contains the SvelteKit server, authentication, and web routes.

Read [how workspaces work](docs/dev/how-workspaces-work.md), [how agents work](docs/dev/how-agents-work.md), and [how the hosted app works](docs/dev/how-the-hosted-app-works.md).
See [Sila 2 status](docs/dev/sila2-status.md) for verified behavior and remaining work.

To run the hosted app locally:

```sh
git submodule update --init --recursive
npm ci
npm run dev
```

Use Node.js 22.20 or later. Installation builds the pinned AIWrapper submodule
and its nested AIModels catalog. See [dependency development](docs/dev/dependencies.md)
for updating or editing them without publishing npm packages.

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
