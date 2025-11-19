# Proposal: Plugin System for Flow Execution

## Problem Statement
- Users want to create reusable, shareable plugins for flow pipelines (e.g., video editing, image processing, data transformation).
- Plugins should be stored in workspaces and importable by name, similar to npm packages but workspace-local.
- Plugins need to work within the QuickJS sandbox environment with the same security constraints as flow code.

## Current Context
- **Flow execution**: Flow files (`.flow.js`) execute in QuickJS sandbox via Web Workers.
- **Pipeline API**: Global `pipeline` object provides `inImg()`, `inText()`, `describe()` functions.
- **Workspace storage**: Files stored in RepTree-backed virtual file system (workspace assets or chat files).
- **File resolution**: Tools can resolve `file:///assets/...` and `file:...` paths to workspace files.

## Goals
1. Allow users to create plugins as `.flow.js` files in workspace `plugins/` directory.
2. Enable importing plugins by name: `const { editVideo } = pipeline.plugin("video-editor")`.
3. Plugins execute in the same QuickJS sandbox as flow code (same security model).
4. Support plugin discovery and listing for UI.
5. Keep plugins workspace-local (no external package manager for v1).

## Non-Goals
- External npm/CDN plugin registry (can be follow-up work).
- Plugin versioning or dependency management (v1).
- Plugin isolation in separate workers (same sandbox for simplicity).
- Plugin marketplace or distribution (v1 focuses on workspace-local plugins).

## Success Criteria
- User can create `plugins/video-editor.flow.js` with exported functions.
- Flow code can import and use: `const { editVideo } = pipeline.plugin("video-editor")`.
- Plugins can use the same pipeline API (`inImg`, `inText`, etc.) and services.
- Plugin code is validated and executes safely within QuickJS limits.

## Design

### Plugin Storage
Plugins stored in workspace file system:
```
workspace/
  plugins/
    video-editor.flow.js
    image-processor.flow.js
    data-transformer.flow.js
```

Alternative locations (checked in order):
1. `file:///plugins/{name}.flow.js` (workspace root)
2. `file:///assets/plugins/{name}.flow.js` (workspace assets)

### Plugin Format
Plugins are standard `.flow.js` files that export functions:

```js
// plugins/video-editor.flow.js
const { inImg, inText } = pipeline;

async function editVideo(video, options) {
  // Implementation using pipeline API
  const processed = await services.img([video], "Apply video effects", options);
  return processed[0];
}

async function trimVideo(video, startTime, endTime) {
  // Implementation
  return trimmedVideo;
}

// Export functions (QuickJS-compatible)
// Note: QuickJS doesn't support ES modules, so we'll use a different pattern
// Functions are registered in a plugin registry object
```

**Export Pattern** (QuickJS-compatible):
Since QuickJS doesn't support ES modules, plugins use a registration pattern:

```js
// plugins/video-editor.flow.js
const { inImg, inText } = pipeline;

async function editVideo(video, options) {
  // Implementation
}

async function trimVideo(video, start, end) {
  // Implementation
}

// Register exports (handled by plugin loader)
plugin.exports = { editVideo, trimVideo };
```

Or simpler: plugin loader executes plugin code and extracts functions from global scope or a `plugin.exports` object.

### API Design

**Usage in Flow Code:**
```js
const { inImg, describe, plugin } = pipeline;

describe("Add logo to video");
const video = inImg("video", "Input video");
const logo = inImg("logo", "Logo to add");

const { addLogo, trimVideo } = plugin("video-editor");

async function run(services) {
  const trimmed = await trimVideo(video, 0, 10);
  const result = await addLogo(trimmed, logo);
  return result;
}
```

**Alternative API** (if `plugin()` feels inconsistent):
```js
const { inImg, describe } = pipeline;
const { addLogo } = services.plugin("video-editor");
```

**Recommendation**: Use `pipeline.plugin()` for consistency with other pipeline functions.

### Implementation

#### 1. Plugin Registry Interface
```typescript
interface PluginRegistry {
  resolve(name: string, space: Space, appTree?: AppTree): Promise<string>;
  list(space: Space, appTree?: AppTree): Promise<string[]>;
}
```

#### 2. Plugin Resolution
```typescript
async function resolvePlugin(
  name: string,
  space: Space,
  appTree?: AppTree
): Promise<string> {
  // Try workspace plugins first
  const workspacePath = `file:///plugins/${name}.flow.js`;
  try {
    return await resolveWorkspaceFileUrl(workspacePath, space, appTree);
  } catch {
    // Try assets
    const assetsPath = `file:///assets/plugins/${name}.flow.js`;
    return await resolveWorkspaceFileUrl(assetsPath, space, appTree);
  }
}
```

#### 3. Plugin Loader in QuickJS
```typescript
// In flowWorker.ts - inject plugin loader
const pluginLoader = context.newFunction("plugin", async (nameHandle: QuickJSHandle) => {
  const pluginName = context.getString(nameHandle);
  
  // Resolve plugin code from workspace
  const pluginCode = await resolvePlugin(pluginName, space, appTree);
  
  // Create plugin execution context
  const pluginContext = context.newObject();
  context.setProp(pluginContext, "exports", context.newObject());
  
  // Inject pipeline API into plugin
  context.setProp(pluginContext, "pipeline", pipelineModule);
  
  // Execute plugin code in isolated scope
  const pluginResult = context.evalCode(pluginCode, `<plugin:${pluginName}>`);
  
  // Extract exports from plugin.exports or global scope
  const exports = context.getProp(pluginContext, "exports");
  // ... extract functions from exports
  
  return exports;
});

context.setProp(pipelineModule, "plugin", pluginLoader);
```

#### 4. Plugin Caching
Cache loaded plugins per execution context to avoid re-loading:
```typescript
const pluginCache = new Map<string, QuickJSHandle>();

async function loadPlugin(name: string): Promise<QuickJSHandle> {
  if (pluginCache.has(name)) {
    return pluginCache.get(name)!;
  }
  
  const pluginExports = await resolveAndExecutePlugin(name);
  pluginCache.set(name, pluginExports);
  return pluginExports;
}
```

### Security Considerations
- **Same sandbox**: Plugins run in the same QuickJS context as flow code (same memory/CPU limits).
- **No file system access**: Plugins can only access workspace files via pipeline API.
- **No network access**: Unless explicitly allowed via services.
- **Code validation**: Validate plugin code before execution (syntax check, size limits).

### Future Extensions
- **Plugin isolation**: Run plugins in separate workers for better isolation.
- **External plugins**: Support loading from npm/CDN (with security review).
- **Plugin dependencies**: Allow plugins to depend on other plugins.
- **Plugin versioning**: Support multiple versions of same plugin.
- **Plugin marketplace**: Centralized plugin discovery and distribution.

## Implementation Steps
1. Add `plugin()` function to pipeline API in `flowWorker.ts`.
2. Implement plugin resolver that checks workspace paths.
3. Create plugin loader that executes plugin code and extracts exports.
4. Add plugin caching to avoid re-loading.
5. Update `toolRunFlow.ts` to pass `space` and `appTree` to worker for plugin resolution.
6. Add tests for plugin loading and execution.

## Open Questions
- Should plugins be able to use `services` directly, or only via the flow's `run()` function?
- Should plugins support their own `inImg`/`inText` inputs, or only use what's passed to them?
- How to handle plugin errors (fail fast vs. graceful degradation)?

