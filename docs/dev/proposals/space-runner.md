# SpaceRunner wrapper for space systems

## Goal

Make space wiring easy to follow. Keep setup in one place.

## Problem

Space setup is spread across multiple systems. This makes it hard to see how a space, sync layers, backend, and agent service connect.

## Current flow

- `ClientState` creates pointers and uses `SpaceManager` to add or load spaces.
- `SpaceState` owns connection state. It builds persistence layers per URI.
- `SpaceManager` loads spaces and wires persistence layers and secrets.
- `SpaceState` creates `Backend` after the space is loaded.
- `ChatAppBackend` creates `AgentServices` per chat app tree.

## Proposal

Create a `SpaceRunner` wrapper. It owns one space and its runtime services. `SpaceManager` uses it to create, start, stop, and dispose spaces.

### Scope

- Space instance
- Sync layers (RepTree + persistence)
- Backend (data, files, protocols)
- Agent service

### Responsibilities

- Build and wire dependencies in one place.
- Start and stop lifecycle for all space services.
- Expose a small API for common tasks.
- Provide a `dispose()` for cleanup.

### Non-goals

- Do not add status events now. Add them when a use case appears.

### Sketch

```ts
class SpaceRunner {
  constructor({ spaceId, config, integrations }) {}
  async start() {}
  async stop() {}
  async dispose() {}

  get space() {}
  get sync() {}
  get backend() {}
  get agentService() {}
}
```

`SpaceManager` keeps a map of `SpaceRunner` by space id. It delegates lifecycle calls to each runner.

## Migration plan

1. Add `SpaceRunner` with current wiring. No behavior changes.
2. Move space setup logic from `SpaceManager` into `SpaceRunner`.
3. Update call sites to use `SpaceManager` methods only.
4. Remove old wiring code after parity.
5. Add a small test helper if it stays simple.

## Risks

- Hidden coupling in current setup may surface later.
- Lifecycle order bugs if start and stop are mismatched.

## Open questions

- Do we need space-level lifecycle hooks beyond `start` and `stop`?
