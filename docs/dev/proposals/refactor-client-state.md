## Refactor: Scoped Client State via Svelte Context

### Problem
- We import a global `clientState` singleton across many components and modules. This couples all UI to a single app instance and prevents running isolated instances (gallery, tests, embedded apps).
- Current usages span app UI, forms, markdown rendering, gallery demos, proposals/docs examples, etc. Grep shows direct imports in many files like `packages/client/src/lib/comps/...`, `packages/gallery/...`, and documentation.

### Goals
- Allow multiple, fully isolated client state instances in the same runtime (e.g., gallery sandboxes, multi-pane dev tooling, tests).
- Preserve simple default usage for the app: components should continue to work with a global instance without changes.
- Minimize churn: components switch to a tiny accessor, not a new prop surface.

### Approach (Svelte 5 idiomatic)
Use Svelte context to inject a `ClientState` instance per subtree, with a global fallback.

1) Context accessor
```ts
// @sila/client/state/clientStateContext.ts
import { getContext, setContext } from 'svelte';
import { ClientState, clientState as globalClientState } from './clientState.svelte';

const CLIENT_STATE = Symbol('CLIENT_STATE');

export function provideClientState(instance: ClientState) {
  setContext(CLIENT_STATE, instance);
}

export function useClientState(): ClientState {
  return getContext<ClientState>(CLIENT_STATE) ?? globalClientState;
}
```

2) Provider component
```svelte
<!-- @sila/client/state/ClientStateProvider.svelte -->
<script lang="ts">
  import { provideClientState } from './clientStateContext';
  import { ClientState } from './clientState.svelte';

  let { instance = new ClientState(), children } =
    $props<{ instance?: ClientState, children?: any }>();

  provideClientState(instance);
</script>

{@render children?.()}
```

3) Component usage
```ts
import { useClientState } from '@sila/client/state/clientStateContext';
const clientState = useClientState();
```

4) Multi-instance usage
```svelte
<ClientStateProvider instance={new ClientState()}>
  {@render children?.()}
</ClientStateProvider>
```

### Migration (single pass)
- Add `clientStateContext.ts` and `ClientStateProvider.svelte`.
- Replace direct imports of `clientState` with `useClientState()` across Svelte components:
  - `packages/client/src/lib/comps/**`
  - `packages/gallery/**`
- For non-Svelte TS modules, accept `client: ClientState` as a parameter or keep using the global as an explicit choice.
- Update docs and examples to use `useClientState()` and `ClientStateProvider` where isolation is needed.

### Backward Compatibility
- `useClientState()` falls back to the existing singleton. Unwrapped subtrees and legacy modules continue to work.
- No behavioral change for users unless a subtree is wrapped to isolate state.

### Risk and Mitigations
- Mixed usage (some components using global, some using context) could cause confusion: mitigate with a lint rule or grep task during sweep.
- Context-only code in non-Svelte modules: avoid by passing `ClientState` explicitly.

### Testing
- Add a gallery page that renders two independent `ClientStateProvider` subtrees side-by-side. Verify spaces, drafts, and UI state are isolated.
- Unit test components by wrapping with a provider and a mocked `ClientState`.

### Performance
- Context lookup is O(1) and negligible. Memory cost is tied to number of instances created; providers should be used judiciously (e.g., demos/tests).

### Rollout Checklist
- [ ] Add context accessor and provider component in `@sila/client/state/`.
- [ ] Switch gallery components to `useClientState()`.
- [ ] Sweep `packages/client/src/lib/comps/**` to `useClientState()`.
- [ ] Update docs and code examples.
- [ ] Add dual-instance gallery demo for verification.

### Appendix: Current Usage Hotspots (non-exhaustive)
- `packages/client/src/lib/comps/...` (forms, apps, markdown components)
- `packages/gallery/src/lib/...` and routes
- Docs examples referencing `clientState` directly


