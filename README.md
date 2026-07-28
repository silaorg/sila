# Heswe

Heswe means healthy, smart, and wealthy. It is AI that does things for teams and businesses.

Heswe runs on Linux servers with AI agents that can use the CLI and other tools to analyze data, check logs, review code, handle support tickets, and more. Users communicate with agents through channels including Slack and Telegram. Other channels can support chat, phone calls, and email.

Website: [heswe.com](https://heswe.com)

## App server

The hosted app uses a same-origin SvelteKit API, Better Auth sessions, SQLite
accounts, and server-sent events. The browser never reads a workspace locally.

See [the hosted workspace app architecture](docs/dev/proposals/workspace-web-app.md)
for configuration and deployment.
