# Land Local Packaged Tools

## Summary

Let a land add executable tools as small Node packages under `<land>/tools/<tool-name>/`.
Each tool is discovered by its `package.json`, loaded at runtime, and injected into the chat agent tool list for that message.

This keeps the architecture close to how skills already work:

- skills are discovered from the filesystem and injected into instructions
- tools would be discovered from the filesystem and injected into `availableTools`

## Problem

Today all executable tools are compiled into `@sila/agents` in `packages/agents/src/chat-agent.js`.
If a land needs one business-specific action, we have to edit core code, add tests in the repo, and redeploy the core runtime.

That is too heavy for land-specific workflows.

The earlier raw `.js` file idea works, but it is a weak packaging boundary:

- one file is awkward once a tool needs helpers, schemas, or tests
- there is no natural place for tool-specific dependencies
- a package shape is more familiar and easier to evolve

## Goals

- Let a land add custom tools without editing core agent code.
- Use a package-per-tool layout that can hold code and dependencies.
- Keep built-in tools unchanged and always available.
- Keep loading deterministic and easy to debug.
- Reload tools during runtime without restarting the land.
- Keep the first implementation small and easy to explain.

## Non-Goals

- Sandboxing untrusted tool code.
- Automatic package installation in v1.
- Overriding built-in tools in v1.
- Multi-language tool plugins in v1.
- Agent-specific tool scopes in v1.

## Proposed Layout

```text
<land>/
  package.json
  package-lock.json
  tools/
    jira-search/
      package.json
      index.js
    send-invoice/
      package.json
      index.js
```

Each tool directory is a standalone Node package.
The loader scans `<land>/tools/*/package.json`.

Recommended land root `package.json`:

```json
{
  "name": "my-land",
  "private": true,
  "workspaces": ["tools/*"]
}
```

In v1 we keep the scope land-wide only.
If we want agent-specific tools later, we can extend the same model to `agents/<agent-name>/tools/<tool-name>/package.json`.

## Package Contract

Example:

```json
{
  "name": "@acme/jira-search",
  "private": true,
  "type": "module",
  "main": "./index.js",
  "dependencies": {
    "jira-client": "^8.2.2"
  }
}
```

Example entry module:

```js
export function createTool(context) {
  return {
    name: "jira_search",
    description: "Search Jira issues by JQL.",
    parameters: {
      type: "object",
      properties: {
        jql: { type: "string" }
      },
      required: ["jql"]
    },
    handler: async ({ jql }) => {
      return { status: "ok", items: [] };
    }
  };
}
```

Tool entry resolution in v1:

- use `package.json.main` when present
- otherwise fall back to `index.js`

Allowed exports:

- named `createTool(context)` returning a tool object
- default export function returning a tool object
- default export plain tool object

Tool object shape matches current `aiwrapper` tools:

- `name`
- `description`
- `parameters`
- `handler`

## Context Passed To Tool Factories

Each tool factory gets a small runtime context:

- `landPath`
- `threadDir`
- `threadId`
- `channel`
- `sourcePath`
- `defaultCwd`
- `logger`

That is enough for most land-local business tools without introducing a second abstraction layer.

## Runtime Wiring

Add a land tool loader in `packages/silaland/src/tools.js`, parallel to `packages/silaland/src/skills.js`.

Responsibilities:

- discover `<land>/tools/*/package.json`
- sort by tool directory name
- read and validate package metadata
- resolve the entry file
- import the entry module
- call the factory with runtime context
- validate the returned tool object

Then thread loaded tools through the existing runtime path:

- extend `InProcessChatAgentRuntime` with `loadTools?: (input) => Promise<Array<Tool>>`
- resolve custom tools per `handleThreadMessage` call, just like `loadInstructions`
- pass `customTools` through `ThreadAgent` into `createChatAgent`
- append `customTools` after built-in tools

This keeps channels thin and keeps assembly logic in the same place where we already load instructions and skills.

## Resolution And Precedence

Load order per message:

1. built-in tools from `createChatAgent`
2. land tools from `<land>/tools/<tool-name>/package.json`

Rules:

- tool packages are sorted by directory name for stable behavior
- duplicate custom tool names are rejected
- collisions with built-in tool names are rejected in v1
- invalid packages are skipped with a clear log line including the absolute path
- one broken tool does not stop the land from running

## Reload Behavior

Target behavior is the same as skills: file changes should apply without restarting the land.

Simple v1 approach:

- resolve the package entry file on each message
- cache based on `package.json` and entry file `mtimeMs`
- re-import when either changes

This is enough for quick iteration and avoids adding watch infrastructure.

## Install Model

The runtime only loads tools. It does not install them.

Recommended setup in v1:

- add a land root `package.json` with `workspaces: ["tools/*"]`
- keep each tool as its own package under `tools/*`
- run `npm install` at the land root

Why this should be the recommended path:

- tools can share packages
- the land gets one lockfile
- install and deploy become simpler
- the runtime does not need to know anything special about workspaces

Fallback:

- if a land does not use workspaces, a tool package can still manage its own dependencies locally

This keeps the runtime simple while giving lands a clean package model.

## Why This Is Better Than Raw JS Files

- it gives each tool a clean place for dependencies and helper modules
- it uses the standard Node package boundary instead of a custom ad hoc script layout
- it stays easy to explain: a land tool is just a small local package that returns one agent tool
- it can grow into richer metadata later without breaking the directory shape

## Security Model

Land tools are trusted local code with full process permissions.
That is the same trust boundary as editing land files or source code on the box.
We should document this explicitly.

## Rollout Plan

1. Add `packages/silaland/src/tools.js` with discovery, import, validation, and cache logic.
2. Extend `InProcessChatAgentRuntime`, `ThreadAgent`, and `createChatAgent` to accept `customTools`.
3. Wire `loadTools` from Slack and Telegram channel runtime creation.
4. Add tests for discovery, loading, collisions, bad packages, and reload behavior.
5. Add `tools/` to the land scaffold and land docs.

## Test Plan

- unit tests for package discovery and entry resolution
- unit tests for invalid `package.json` and invalid tool exports
- unit tests for duplicate name and built-in collision rejection
- runtime tests proving loaded tools appear in `availableTools`
- runtime tests proving package edits reload without restart
- channel integration tests proving both Slack and Telegram pick up land tools

## Open Questions

- Should we support CommonJS tool packages in v1, or require ESM only?
- Should the loader only use `main`, or also support a future `sila.tool.entry` field if we want explicit metadata?
- Do we want to surface loaded custom tool names in managed instructions for easier debugging, or is `availableTools` enough?
