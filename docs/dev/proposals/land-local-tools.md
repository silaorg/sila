# Land Local JS Tools

## Summary

Add filesystem-defined tools that are loaded into the agent tool list at runtime.

Two scopes:

- land-wide tools: `<land>/tools/*.js`
- agent-specific tools: `<land>/agents/<agent-name>/tools/*.js` (for now, `agent-name = default`)

This gives lands the same extensibility model that skills already provide, but for executable tools.

## Problem

Today all executable tools are compiled into `@sila/agents` (`packages/agents/src/chat-agent.js`).
To add one custom business tool, we must edit core code, test it, and redeploy.
That is too heavy for land-specific workflows.

Skills solve discoverability by loading from disk, but they do not add executable capabilities.
We need a local, simple way to add capabilities without forking core agent logic.

## Goals

- Let a land add custom tools by dropping JS files into known folders.
- Keep built-in tools unchanged and always available.
- Support both land-wide and agent-specific tool scopes.
- Keep behavior deterministic and easy to debug.
- Reload tools during runtime without restarting the land process.

## Non-Goals

- Sandboxing untrusted JS.
- Replacing built-in tools with local overrides in v1.
- Remote tool registries or package installation flows.
- Multi-language tool plugins in v1.

## Proposed UX

Directory layout:

```text
<land>/
  tools/
    jira-search.js
  agents/
    default/
      instructions.md
      tools/
        send-invoice.js
```

Tool module contract:

```js
// land/tools/jira-search.js
export default function createTool(context) {
  return {
    name: "jira_search",
    description: "Search Jira issues by JQL.",
    parameters: {
      type: "object",
      properties: {
        jql: { type: "string" },
      },
      required: ["jql"],
    },
    handler: async ({ jql }) => {
      // call external API
      return { status: "ok", items: [] };
    },
  };
}
```

Allowed exports:

- `default` function returning a tool object (preferred)
- `createTool` named export returning a tool object
- `default` plain tool object (no context needed)

Context passed to factory:

- `landPath`
- `agentName`
- `channel`
- `threadId`
- `threadDir`
- `defaultCwd`
- `logger` (`console` in v1)

## Resolution And Precedence

Load tools per message in this order:

1. built-in core tools from `createChatAgent`
2. land tools from `<land>/tools/*.js`
3. agent tools from `<land>/agents/<agent-name>/tools/*.js`

Rules:

- Sort by filename to keep order stable.
- Reject duplicate tool names across local tools.
- Reject collisions with built-in tool names in v1.
- Log skip reasons with absolute file path and error.

## Runtime Wiring

Add a local-tool loader in `packages/land/src` similar to `skills.js`:

- discover files in both tool directories
- import modules
- validate tool shape (`name`, `description`, `parameters`, `handler`)
- return normalized tool definitions

Pass loaded tools through channel runtime creation:

- extend `InProcessChatAgentRuntime` options with `loadTools?: () => Promise<CustomTool[]>`
- resolve tools per `handleThreadMessage` call (same cadence as `loadInstructions`)
- pass resolved tools into `ThreadAgent` and then `createChatAgent`
- extend `createChatAgent` options with `customTools?: Tool[]`

This keeps channels thin and keeps tool assembly in one place.

## Reload Behavior

Target behavior: file edits should apply without process restart.

Implementation detail for v1:

- resolve module cache key with file `mtimeMs` (for example via file URL query)
- re-import when mtime changes
- cache parsed tools in memory for unchanged files

## Security Model

Local JS tools are trusted code with full process permissions.
This is the same trust boundary as editing land source files.
Document this explicitly in land docs.

## Rollout Plan

1. Add proposal-approved loader module and validation logic.
2. Thread `loadTools` through `channel-utils` and channel runtime constructors.
3. Extend `createChatAgent` to merge `customTools`.
4. Add deterministic conflict handling and clear logs.
5. Add tests for loading, precedence, collisions, runtime reload, and bad module shapes.
6. Optionally add `tools/` directory creation to `createLand` scaffold.

## Test Plan

- unit tests for loader discovery and validation
- unit tests for duplicate and built-in collision rejection
- runtime tests proving tool availability in `availableTools`
- runtime tests proving file changes reload tool behavior
- channel integration tests proving both Slack and Telegram flows pick up custom tools

## Open Questions

- Should built-in collisions be hard errors or warnings with skip? Proposal uses skip.
- Should agent-specific tools be additive only, or should they be able to hide land-wide tools?
- Do we want an optional metadata header in tool files (`name`, `description`) for faster index without importing?
