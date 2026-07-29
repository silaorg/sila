# heswe

Heswe runs AI agents inside portable workspaces. A workspace keeps
conversations, shared files, agent instructions, skills, tools, provider
settings, and results together in one directory that can be backed up or moved
as a unit.

Agents can work with files, run commands, call tools, and report progress
through the hosted app, Slack, or Telegram. This package contains the workspace
configuration, storage, channels, CLI, and agent runtime that make that
possible.

Website: [heswe.com](https://heswe.com)

## CLI

The package is not published to npm yet. Run it from the repository root:

```sh
npm run workspace -- create my-workspace --channel telegram
npm run workspace -- run my-workspace
```

`create` scaffolds a workspace with configuration, provider settings, `.env`,
and either a Telegram or Slack channel. Add the required provider and channel
credentials before running it.

Use `node packages/heswe/src/cli.js --help` for all options.

## Node API

```js
import { createWorkspace, Workspace } from "heswe";

await createWorkspace({ path: "./my-workspace", channel: "telegram" });

const workspace = new Workspace("./my-workspace");
await workspace.run();

// Later, during graceful shutdown:
await workspace.stop();
```

## Hosted app API

The SvelteKit server uses `AppWorkspaceService` to expose user-scoped threads
without giving browsers filesystem access.

```js
import { ProcessAgentRuntime } from "@heswe/agents";
import { AppWorkspaceService } from "heswe";

const workspacePath = "./my-workspace";
const app = new AppWorkspaceService({
  workspacePath,
  createAgentRuntime: () => new ProcessAgentRuntime({ workspacePath }),
});
const thread = await app.createThread(authenticatedUserId);
```

Accounts and sessions belong to the app server's SQLite database. Agent thread
events remain in the workspace filesystem. The hosted API injects
`ProcessAgentRuntime` from `@heswe/agents` so agent execution occurs in a
separate process.

See [how workspaces work](../../docs/dev/how-workspaces-work.md) and
[how the hosted app works](../../docs/dev/how-the-hosted-app-works.md).
