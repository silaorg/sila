# heswe

This package contains the Heswe workspace CLI, runtime, and Node API.

Website: [heswe.com](https://heswe.com)

## CLI

The package is not published to npm yet. Run it from the repository root:

```sh
npm run workspace -- create my-workspace --channel telegram
npm run workspace -- run my-workspace
```

`create` scaffolds workspace configuration, `.env`, provider settings, and
either a Telegram or Slack channel. Add the required provider and channel
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
import { AppWorkspaceService } from "heswe";

const app = new AppWorkspaceService({ workspacePath: "./my-workspace" });
const thread = await app.createThread(authenticatedUserId);
```

Accounts and sessions belong to the app server's SQLite database. Agent thread
events remain in the workspace filesystem.

See [how workspaces work](../../docs/dev/how-workspaces-work.md) and
[how the hosted app works](../../docs/dev/how-the-hosted-app-works.md).
