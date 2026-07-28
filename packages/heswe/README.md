# heswe

Heswe is the npm package for creating and running workspaces.

Website: [heswe.com](https://heswe.com)

## Install

```bash
npm install -g heswe
```

You can also run it without a global install:

```bash
npx heswe@latest create my-workspace
```

## CLI

```bash
heswe create my-workspace
heswe run my-workspace
```

## JS API

```js
import { createWorkspace, Workspace } from "heswe";

await createWorkspace({ path: "./my-workspace", channel: "telegram" });

const workspace = new Workspace("./my-workspace");
await workspace.run();
```

## Hosted app API

The hosted SvelteKit app uses `AppWorkspaceService` to expose user-scoped
browser threads without giving the browser filesystem access.

```js
import { AppWorkspaceService } from "heswe";

const app = new AppWorkspaceService({ workspacePath: "./my-workspace" });
const thread = await app.createThread(authenticatedUserId);
```

Accounts and sessions belong to the app server's SQLite database. Agent thread
events remain in the workspace filesystem.
