# SpaceRunner wrapper for space systems

## Goal

Make space wiring easy to follow. Keep setup in one place.

## Problem

Space setup is spread across multiple systems. This makes it hard to see how a space, sync layers, backend, and agent service connect.

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

## Risks

- Hidden coupling in current setup may surface later.
- Lifecycle order bugs if start and stop are mismatched.

## Open questions

- Should `SpaceRunner` expose events for status changes?
- Do we need a test helper to build a runner for fixtures?
