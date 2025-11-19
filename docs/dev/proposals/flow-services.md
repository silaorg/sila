# Proposal: Flow Services API

## Problem Statement

Flows need to call services (image processing, AI agents, file operations) that operate on workspace data. These services run outside the QuickJS sandbox in the main app/core. The sandbox should only handle pointers/references to data, not large files. We need a service API that:

1. Passes data references (not large files) through the sandbox boundary
2. Executes services in the main app/core with full access to workspace files
3. Returns results as references that can be used in subsequent service calls
4. Supports multiple service types (image processing, AI agents, file operations)

## Current Context

- **Flow execution**: Flows run in QuickJS sandbox via Web Workers (`flowWorker.ts`)
- **Sandbox limits**: QuickJS has memory/CPU constraints; cannot handle large files
- **Workspace files**: Files stored in RepTree/FileStore with content-addressed storage
- **Service execution**: Services need full access to workspace files and external APIs
- **Existing pattern**: `setup(flow)` defines UI schema, `run(services)` executes logic

## Goals

1. Define service API that passes data references (file IDs, hashes) not file contents
2. Implement service execution in main app/core outside sandbox
3. Support multiple service types: `img()`, `agent()`, file operations
4. Enable chaining: service results can be inputs to other services
5. Track outputs explicitly via `services.outputs(id, value)`

## Non-Goals

- Passing large file contents through sandbox (use references only)
- Implementing all possible services in v1 (start with `img` and `agent`)
- Service discovery or plugin system (covered in flow-plugins.md)
- Service versioning or dependency management

## Success Criteria

- Flow can call `services.img([ref1, ref2], prompt)` with file references
- Service executes in main app/core, accesses actual files, returns result reference
- Flow can chain services: `const result = await services.img(...); await services.agent(result, ...)`
- Flow can set outputs: `services.outputs("img-out", result)`
- All data passing uses references, not file contents

## Design

### Data Flow Pattern

```
Flow Code (Sandbox)           Main App/Core
───────────────────           ──────────────
services.img([ref1, ref2])    → Resolve refs to files
                              → Process files
                              → Store result in FileStore
                              → Return result reference
resultRef ←───────────────────
```

### Service API

Services receive and return data references:

```typescript
interface ServiceReference {
  type: "file" | "image" | "text";
  id: string;           // File ID in workspace
  hash?: string;        // Content hash (optional)
  url?: string;         // Workspace URL (optional)
}

interface Services {
  inputs: Record<string, ServiceReference>;
  outputs: (id: string, value: ServiceReference | ServiceReference[]) => void;
  img: (images: ServiceReference[], prompt: string, options?: any) => Promise<ServiceReference | ServiceReference[]>;
  agent: (input: ServiceReference | ServiceReference[], prompt: string) => Promise<ServiceReference | ServiceReference[]>;
  // Future: file operations, other services
}
```

### Flow Code Pattern

Two supported patterns:

**Pattern 1: setup(flow) + run(services)**
```js
function setup(flow) {
  flow.title("Logo to image");
  flow.describe("A pipeline that allows to add a logo to any image");
  flow.inImg("img-a", "A logo");
  flow.inImg("img-b", "Any photo where the logo is going to be inserted");
  flow.inText("prompt", "Additional prompt for the image", { optional: true });
  flow.outImgs("img-out", "Results");
}

async function run(services) {
  const imgA = services.inputs["img-a"];
  const imgB = services.inputs["img-b"];
  const prompt = services.inputs["prompt"];
  
  const finalPrompt = ["Combine the images...", prompt].join('\n\n');
  const result = await services.img([imgA, imgB], finalPrompt);
  
  services.outputs("img-out", result);
  return result;
}
```

**Pattern 2: Import + setup(flow) + run(services)**
```js
import { inImg } from "pipeline";

const imgA = inImg("img-a", "A photo to modify");

async function setup(flow) {
  flow.title("Photo to 19 century painting");
  flow.inImg("img-1", "A photo");
  flow.outImgs("painting", "Final painting");
}

async function run(services) {
  const result = await services.img([imgA], "Turn it into a 19 century painting", { variants: 5 });
  const theBest = await services.agent(result, "Return the best image...");
  services.output("painting", theBest);
}
```

### Service Implementation

#### 1. Service Request/Response Protocol

```typescript
interface ServiceRequest {
  type: "img" | "agent" | "file";
  inputs: ServiceReference[];
  prompt?: string;
  options?: any;
}

interface ServiceResponse {
  success: boolean;
  result?: ServiceReference | ServiceReference[];
  error?: string;
}
```

#### 2. Service Execution in Main App

Services execute outside sandbox with full workspace access:

```typescript
// In main app/core (not sandbox)
async function executeImageService(
  request: ServiceRequest,
  space: Space,
  appTree?: AppTree
): Promise<ServiceResponse> {
  // 1. Resolve references to actual files
  const files = await Promise.all(
    request.inputs.map(ref => resolveFileReference(ref, space, appTree))
  );
  
  // 2. Process files (call AI model, image processing, etc.)
  const result = await processImages(files, request.prompt, request.options);
  
  // 3. Store result in FileStore
  const resultRef = await storeResult(result, space, appTree);
  
  // 4. Return reference
  return { success: true, result: resultRef };
}
```

#### 3. Service Bridge in Worker

Worker receives service calls, forwards to main app:

```typescript
// In flowWorker.ts
async function createServiceBridge(
  context: QuickJSAsyncContext,
  space: Space,
  appTree?: AppTree
): Promise<QuickJSHandle> {
  const servicesObj = context.newObject();
  
  // services.inputs - populated from user-provided data
  const inputsObj = context.newObject();
  // ... populate with input references
  context.setProp(servicesObj, "inputs", inputsObj);
  
  // services.outputs() - track output values
  const outputsFn = context.newAsyncifiedFunction("outputs", async (idHandle, valueHandle) => {
    const id = context.getString(idHandle);
    const value = extractReference(valueHandle); // Extract ServiceReference
    outputValues[id] = value;
    return context.undefined;
  });
  context.setProp(servicesObj, "outputs", outputsFn);
  
  // services.img() - image processing service
  const imgFn = context.newAsyncifiedFunction("img", async (...args) => {
    const images = extractReferences(args[0]);
    const prompt = context.getString(args[1]);
    const options = args[2] ? extractOptions(args[2]) : undefined;
    
    // Forward to main app via postMessage
    const result = await callServiceInMainApp({
      type: "img",
      inputs: images,
      prompt,
      options
    }, space, appTree);
    
    return convertReferenceToQuickJS(result, context);
  });
  context.setProp(servicesObj, "img", imgFn);
  
  // services.agent() - AI agent service
  const agentFn = context.newAsyncifiedFunction("agent", async (...args) => {
    const input = extractReference(args[0]);
    const prompt = context.getString(args[1]);
    
    const result = await callServiceInMainApp({
      type: "agent",
      inputs: [input],
      prompt
    }, space, appTree);
    
    return convertReferenceToQuickJS(result, context);
  });
  context.setProp(servicesObj, "agent", agentFn);
  
  return servicesObj;
}
```

#### 4. Service Call Bridge

Worker communicates with main app via postMessage:

```typescript
// In flowWorker.ts (worker context)
async function callServiceInMainApp(
  request: ServiceRequest,
  space: Space,
  appTree?: AppTree
): Promise<ServiceReference> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    
    // Send service request to main thread
    self.postMessage({
      type: "service-request",
      requestId,
      request,
      spaceId: space.getId(),
      appTreeId: appTree?.getId()
    });
    
    // Listen for response
    const handler = (e: MessageEvent) => {
      if (e.data.type === "service-response" && e.data.requestId === requestId) {
        self.removeEventListener("message", handler);
        if (e.data.success) {
          resolve(e.data.result);
        } else {
          reject(new Error(e.data.error));
        }
      }
    };
    self.addEventListener("message", handler);
  });
}
```

```typescript
// In toolRunFlow.ts (main thread)
worker.addEventListener("message", async (e: MessageEvent) => {
  if (e.data.type === "service-request") {
    const { request, spaceId, appTreeId } = e.data;
    
    // Get space and appTree
    const space = getSpace(spaceId);
    const appTree = appTreeId ? getAppTree(space, appTreeId) : undefined;
    
    // Execute service in main app
    const result = await executeService(request, space, appTree);
    
    // Send response back to worker
    worker.postMessage({
      type: "service-response",
      requestId: e.data.requestId,
      success: true,
      result
    });
  }
});
```

### Reference Resolution

Convert between sandbox references and workspace files:

```typescript
// Convert workspace file to reference
function fileToReference(file: WorkspaceFile): ServiceReference {
  return {
    type: "image", // or "file", "text"
    id: file.id,
    hash: file.hash,
    url: file.url
  };
}

// Resolve reference to workspace file
async function resolveReference(
  ref: ServiceReference,
  space: Space,
  appTree?: AppTree
): Promise<WorkspaceFile> {
  // Resolve by ID, hash, or URL
  if (ref.id) {
    return await getFileById(ref.id, space, appTree);
  }
  if (ref.hash) {
    return await getFileByHash(ref.hash, space);
  }
  if (ref.url) {
    return await resolveWorkspaceFileUrl(ref.url, space, appTree);
  }
  throw new Error("Invalid reference");
}
```

### Output Tracking

Track outputs set via `services.outputs()`:

```typescript
// In executeFlowCodeWithServices
const outputValues: Record<string, ServiceReference> = {};

// services.outputs() function
const outputsFn = context.newAsyncifiedFunction("outputs", async (idHandle, valueHandle) => {
  const id = context.getString(idHandle);
  const value = extractReference(valueHandle);
  outputValues[id] = value;
  return context.undefined;
});

// After run() completes
return {
  success: true,
  result: outputValues, // { "img-out": <reference> }
  outputs: outputValues
};
```

## Implementation Steps

1. **Define ServiceReference interface** - Data structure for references
2. **Implement reference conversion** - Convert between workspace files and references
3. **Create service bridge in worker** - Inject `services` object with `img()`, `agent()`, `outputs()`
4. **Implement service execution in main app** - `executeImageService()`, `executeAgentService()`
5. **Add service request/response protocol** - postMessage communication between worker and main
6. **Update runFlowWithServices()** - Pass actual input references, track outputs
7. **Add tests** - Test service calls, reference passing, output tracking

## Open Questions

1. **Service variants**: How to handle `{ variants: 5 }` - return array of references?
2. **Service options**: What options should `img()` support? (size, format, quality, etc.)
3. **Error handling**: How to surface service errors to flow code?
4. **Service timeouts**: How long should services wait before timing out?
5. **Service caching**: Should service results be cached by input hash?
6. **Import support**: How to implement `import { inImg } from "pipeline"` in QuickJS?

## Future Extensions

- **More service types**: File operations, data transformation, external APIs
- **Service composition**: Services that call other services
- **Service plugins**: User-defined services (covered in flow-plugins.md)
- **Service monitoring**: Track service execution time, costs, errors
- **Service versioning**: Support multiple versions of same service

