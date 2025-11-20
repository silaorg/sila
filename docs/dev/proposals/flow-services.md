# Proposal: Flow Services v1

This rewrite keeps the proposal scoped to what we can ship immediately. It reflects the current code in `toolRunFlow.ts`, `flowWorker.ts`, and `run-flow.test.ts`, and trims anything that goes beyond a minimal, working bridge between the sandbox and host services.

## Snapshot Of Today
- Flow files already run inside a QuickJS worker (`run_flow` tool). `setup(flow)` metadata is captured by `inspectFlow`, and `run(services)` is invoked during execution.
- When `runFlowWithServices` receives a `services` object, the worker injects those functions directly and executes them **inside** the sandbox. They can’t reach workspace files or main-app APIs.
- Tests (`run-flow.test.ts`) cover simple script execution, metadata extraction, and a mocked `services.processImage`, but there is no host/service bridge or reference passing.

## Objective
Let flows call two host-provided services—`services.img` and `services.agent`—without leaving the QuickJS sandbox or inventing a new plugin system. Everything else stays as follow-up work.

## Scope & Constraints (V1)
1. **Services**: only `img` and `agent`, plus the existing `services.inputs` / `services.outputs`.
2. **Data**: inputs and outputs are plain JSON. When a flow needs a file it receives a `{ kind: "file", fileId: string }`. No hashes, URLs, or streaming blobs yet.
3. **Bridge**: the worker serializes every service call as `{ id, service, args }` and waits for a `{ id, ok, result | error }` response from the host thread. The host owns workspace access and option parsing.
4. **Execution**: one flow at a time per worker. Calls are awaited sequentially; there is no retry, concurrency control, or caching.
5. **Errors**: if the host rejects a call, the worker throws, causing `run(services)` to reject as well. That’s sufficient for agents to handle failures.

## Author-Facing API

```js
function setup(flow) {
  flow.title("Logo overlay");
  flow.inImg("logo", "Logo");
  flow.inImg("photo", "Photo");
  flow.outImgs("result", "Output");
}

export async function run(services) {
  const logo = services.inputs.logo;            // { kind: "file", fileId }
  const photo = services.inputs.photo;
  const prompt = "Blend the logo into the photo";

  const result = await services.img([logo, photo], prompt);
  services.outputs("result", result);
}
```

That’s the only JS API we need to document. Advanced helpers such as `import { inImg } from "pipeline"` live in future work.

## Worker ↔ Host Contract

```ts
type ServiceValue =
  | string
  | number
  | boolean
  | null
  | { kind: "file"; fileId: string }
  | ServiceValue[];

interface FlowServiceCall {
  kind: "flow-service-call";
  callId: string;
  service: "img" | "agent";
  args: ServiceValue[];
}

interface FlowServiceResponse {
  kind: "flow-service-response";
  callId: string;
  ok: boolean;
  result?: ServiceValue;
  error?: string;
}
```

The worker keeps a pending `Promise` per `callId` and resolves it when the host replies. `services.inputs` is populated from the `inputs` map we already send in `runFlowWithServices`.

## Execution Path
1. `toolRunFlow` loads the `.flow.js` file and posts `{ type: "run", code, inputs }` to the worker (this already exists).
2. `executeFlowCodeWithServices` evaluates the code, builds the `services` object, and injects `img`/`agent` functions that proxy to `callService`.
3. `callService` posts a `FlowServiceCall` to the host and returns a promise.
4. `toolRunFlow` listens for `flow-service-call`, invokes the real service implementation (can hit FileStore, AI APIs, etc.), and responds with `flow-service-response`.
5. The worker resolves the promise and hands the value back to flow code. When `run` finishes, it returns `result` plus `services.outputs`.

## Implementation Plan
1. **Bridge plumbing**
   - Extend `FlowWorkerRequest/Response` to allow sub-messages of kind `"flow-service-call"` without creating a second worker.
   - Add `callService` + pending promise map in `flowWorker.ts`.
   - Update `executeFlowCodeWithServices` so `services.img/agent` use the bridge instead of mock descriptors.
2. **Host wiring**
   - In `toolRunFlow.ts`, register handlers for `flow-service-call` messages before posting the run request.
   - Provide thin adapters `executeImageService` and `executeAgentService`. For now they can be placeholders that just echo inputs—the important part is the boundary.
3. **Outputs**
   - Keep `services.outputs` as a simple JS object captured inside the worker and return it as `response.outputs` (matching today’s behavior, but now we actually surface the values).
4. **Cleanup**
   - Remove the unused `serviceRegistry` / `servicesDescriptor` path once the bridge works.

## Test Runs
- Add a `test_flow` tool that loads a `.flow.js` file and executes it with built-in simulated services (`simulate: "img"` / `"agent"` descriptors).  
- The QuickJS worker captures `services.outputs(id, value)` and returns them alongside the final result so agents can assert output wiring without calling real backends.
- Simulated `img` services return `{ kind: "file", fileId, meta: { simulated: true, prompt, options } }`. Simulated `agent` services return `{ kind: "text", value, meta: { simulated: true, inputSummary } }`.  
- Agents pass sample `inputs` when invoking `test_flow`, mirroring how real runs will work. Once the host bridge is ready we can swap these test services for real ones or keep them as a smoke-test mode.

## Tests (Vitest)
1. `services.img` call is proxied to the host stub and resolves to the stubbed value.
2. `services.outputs` returns `{ id: value }` in the run result.
3. Host error rejects the flow promise and surfaces the error string.

These live in `packages/core/tests/src/tools/run-flow.test.ts`.

## Out Of Scope / Follow-Ups
- Additional service types (`file`, `audio`, etc.), variants/options negotiation, and caching.
- Passing large binaries or streaming data through the worker.
- Import-time helpers (`pipeline` module), service discovery, or versions.
- Timeouts, concurrency limits, tracing, or run history.

Keeping v1 this small lets us ship something useful quickly and iterate once real flows start calling host services.

