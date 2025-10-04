## Proposal: silaSignals — Unified Electron → Client signaling

### Problem
- Electron backend modules (updater, releases, spaces, menu, dialogs) use one-off IPC handlers and ad‑hoc UI triggers.
- The client cannot subscribe to backend events in a consistent, typed way (e.g., update available, download progress, background jobs).
- We need a single, reliable pathway for backend modules to publish events and for the client to handle them reactively.

### Goals
- Provide a unified, typed, and minimal API for push-style events from Electron to the client.
- Support multiple sources (updater, GitHub releases, space manager, menu, dialogs, custom).
- Work with contextIsolation enabled and our current preload bridge pattern.
- Play well with Svelte 5 runes and be easy to consume in UI.
- Allow optional sticky signals (replay of latest state for late subscribers).

### Non‑Goals
- Full request/response replacement (continue to use `ipcMain.handle/ipcRenderer.invoke` for RPC calls).
- Cross‑process eventing beyond Electron main → current renderer window(s).

---

## Design Overview

- Single channel name for push events: `sila:signal`.
- Main process owns a central `SignalHub` for emitting signals and managing optional sticky state.
- Preload exposes a small, safe bridge `window.silaSignals` to subscribe/unsubscribe and to fetch sticky snapshots.
- Client wraps the bridge with a tiny utility for filters and Svelte 5 runes integration.

```
[main modules] ── emit(signal) ─▶ SignalHub ─ webContents.send('sila:signal', envelope) ─▶ preload listener ─▶ window.silaSignals callbacks
```

### Signal Envelope (typed)

- Discriminated by `type` (domain/topic namespace + action): `"updater/available"`, `"updater/downloading"`, `"space/registered"`, `"menu/action"`, etc.
- Minimal required fields: `id`, `type`, `payload`, `source`, `ts`.
- Optional: `level` (info/warning/error/success), `sticky` (eligible for replay), `meta` (freeform).

```ts
export type SilaSignalType =
  | 'updater/checking'
  | 'updater/available'
  | 'updater/downloading'
  | 'updater/downloaded'
  | 'updater/error'
  | 'menu/action'
  | 'space/registered'
  | 'space/unregistered'
  | 'custom';

export interface SilaSignalEnvelope<TType extends SilaSignalType = SilaSignalType, TPayload = unknown> {
  id: string;             // uuid
  type: TType;            // e.g., 'updater/available'
  payload: TPayload;      // typed per discriminator
  source: string;         // e.g., 'autoUpdater', 'githubReleaseManager'
  ts: number;             // epoch ms
  level?: 'info' | 'warning' | 'error' | 'success';
  sticky?: boolean;       // include in sticky replay
  meta?: Record<string, unknown>;
}
```

Examples:

```ts
// update available
{
  id: '...',
  type: 'updater/available',
  payload: { version: '1.2.3' },
  source: 'autoUpdater',
  ts: Date.now(),
  level: 'info',
  sticky: true
}

// download progress
{
  id: '...',
  type: 'updater/downloading',
  payload: { percent: 42 },
  source: 'githubReleaseManager',
  ts: Date.now()
}
```

---

## Main process API (SignalHub)

- Singleton module that modules can import to publish signals.
- Broadcasts to all existing BrowserWindows by default.
- Maintains an in‑memory map of last sticky signal per `type` (configurable) for replay.

```ts
// packages/desktop/src-electron/silaSignalsMain.ts (new)
import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';

export type EmitOptions = {
  sticky?: boolean;             // default: false
  level?: 'info' | 'warning' | 'error' | 'success';
};

class SignalHub {
  private stickyByType = new Map<string, SilaSignalEnvelope>();

  emit<TType extends SilaSignalType, TPayload>(
    type: TType,
    payload: TPayload,
    source: string,
    options: EmitOptions = {}
  ): void {
    const envelope: SilaSignalEnvelope<TType, TPayload> = {
      id: randomUUID(),
      type,
      payload,
      source,
      ts: Date.now(),
      level: options.level,
      sticky: !!options.sticky
    };

    if (envelope.sticky) this.stickyByType.set(type, envelope);

    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('sila:signal', envelope);
    }
  }

  getStickySnapshot(): SilaSignalEnvelope[] {
    return Array.from(this.stickyByType.values());
  }
}

export const signalHub = new SignalHub();
```

Usage in main modules:

```ts
// autoUpdater events
autoUpdater.on('update-available', (info) => {
  signalHub.emit('updater/available', { version: info.version }, 'autoUpdater', { sticky: true });
});

autoUpdater.on('update-downloaded', (info) => {
  signalHub.emit('updater/downloaded', { version: info.version }, 'autoUpdater', { sticky: true, level: 'success' });
});

// menu actions
menuItem.click = () => {
  signalHub.emit('menu/action', { action: 'new-file' }, 'electronMenu');
};
```

---

## Preload bridge API

Expose a minimal, safe surface under `window.silaSignals`:
- `subscribe(handler)` → returns `unsubscribe`
- `subscribeBy(type, handler)` typed convenience
- `getStickySnapshot()` → Promise of current sticky signals

```ts
// packages/desktop/src-electron/preloadSignals.ts (new)
import { contextBridge, ipcRenderer } from 'electron';

export type Unsubscribe = () => void;

function subscribe(handler: (s: SilaSignalEnvelope) => void): Unsubscribe {
  const listener = (_: unknown, envelope: SilaSignalEnvelope) => handler(envelope);
  ipcRenderer.on('sila:signal', listener);
  return () => ipcRenderer.removeListener('sila:signal', listener);
}

function subscribeBy<TType extends SilaSignalType>(
  type: TType,
  handler: (s: Extract<SilaSignalEnvelope, { type: TType }>) => void
): Unsubscribe {
  return subscribe((s) => {
    if (s.type === type) handler(s as any);
  });
}

async function getStickySnapshot(): Promise<SilaSignalEnvelope[]> {
  return ipcRenderer.invoke('sila:signals:get-sticky');
}

contextBridge.exposeInMainWorld('silaSignals', {
  subscribe,
  subscribeBy,
  getStickySnapshot
});
```

And add a single IPC handler in main to serve sticky snapshots:

```ts
// packages/desktop/src-electron/main.ts
ipcMain.handle('sila:signals:get-sticky', () => signalHub.getStickySnapshot());
```

Finally, wire the preload file in our existing `preload.js` after other bridges.

---

## Renderer utility + Svelte 5 runes

Provide a tiny client helper so UI can filter by type and use runes comfortably.

```ts
// packages/client/src/lib/silaSignals.ts (new)
export function onSignal<TType extends SilaSignalType>(
  type: TType,
  handler: (s: Extract<SilaSignalEnvelope, { type: TType }>) => void
): () => void {
  return window.silaSignals.subscribeBy(type, handler as any);
}

export async function getSticky(): Promise<SilaSignalEnvelope[]> {
  return window.silaSignals.getStickySnapshot();
}
```

Svelte 5 usage:

```svelte
<script lang="ts">
  let updateInfo: { version: string } | null = $state(null);
  let downloadPercent: number = $state(0);

  let unsubscribe = () => {};

  $effect(() => {
    unsubscribe();
    // Subscribe to two signal types
    const offAvailable = onSignal('updater/available', (s) => {
      updateInfo = { version: s.payload.version };
    });
    const offDownloading = onSignal('updater/downloading', (s) => {
      downloadPercent = s.payload.percent;
    });
    unsubscribe = () => { offAvailable(); offDownloading(); };
  });

  // On mount, replay sticky state once for late subscribers
  (async () => {
    const sticky = await getSticky();
    const available = sticky.find((s) => s.type === 'updater/available');
    if (available) updateInfo = { version: (available as any).payload.version };
  })();
</script>
```

---

## Naming, types, and conventions

- Use `domain/action` for `type`—short, consistent verbs: `updater/available`, `updater/downloading`, `space/registered`, `menu/action`.
- Keep `payload` small and serializable. Prefer IDs over large objects.
- Use `sticky` for stateful/latest signals you want replayed to late subscribers (e.g., `updater/available`, `updater/downloaded`). Avoid stickiness for progress spam.
- `source` is a free string for debugging (module name). Do not branch logic on it in UI.

---

## Ordering, delivery, and performance

- Delivery: best‑effort, in‑order per BrowserWindow (Electron’s `webContents.send`).
- No acknowledgements or retries. Signals should be idempotent at UI level.
- Sticky replay is instantaneous and bounded by the number of sticky types.
- Broadcasting to multiple windows: by default all windows receive signals. If needed later, add window‑scoped channels without breaking the global API.

---

## Security

- Only a minimal bridge is exposed. No arbitrary execution.
- All outbound envelopes originate in trusted main process modules.
- The bridge forwards events; it does not accept renderer->main emits on this channel.
- Keep `type` strings static (no user input) and validate payloads at emit sites.

---

## Migration Plan

1) Introduce `SignalHub` and preload bridge (behind feature flag if desired).
2) Emit updater signals:
   - `updater/checking`, `updater/available{version}`, `updater/downloading{percent}`, `updater/downloaded{version}`, `updater/error{message}`.
3) Emit release manager progress (optional): `updater/downloading{percent}` while zip downloads.
4) Emit menu actions via signals instead of ad‑hoc `webContents.send` in examples/docs: `menu/action{action}`.
5) Emit space registration events: `space/registered{spaceId}`, `space/unregistered{spaceId}`.
6) Add a small client helper in `@sila/client` and refactor Dev Panel (or relevant UI) to listen to signals.
7) Update docs and examples to prefer `silaSignals` over custom channels.

Backward compatibility: existing RPC (`ipcMain.handle/ipcRenderer.invoke`) stays; we only add push.

---

## Open Questions
- Do we need per‑window scoping now, or is broadcast sufficient? (Propose: defer until we have multi‑window UI.)
- Should we persist sticky signals to disk for crash recovery? (Propose: not initially.)
- Should we support renderer→main custom signals? (Propose: keep as RPC to avoid abuse and keep responsibilities clear.)

---

## Rollout Checklist (engineering)
- [ ] Add `silaSignalsMain.ts` and `preloadSignals.ts`; wire into `preload.js` and `main.ts` sticky handler.
- [ ] Emit updater signals in `autoUpdater` hooks.
- [ ] (Optional) Emit progress in `GitHubReleaseManager.downloadFile`.
- [ ] Replace any `webContents.send` usages in docs/examples with `signalHub.emit`.
- [ ] Add `@sila/client` utilities and refactor a UI to consume (`Dev Panel`/updates UI).
- [ ] Add unit tests for envelope shape and sticky replay; add Playwright UI smoke where suitable.

---

## Summary
silaSignals introduces a single, typed, and minimal signaling path from Electron main to the client. It standardizes how backend modules publish events, supports sticky state replay for late subscribers, and integrates cleanly with Svelte 5 runes. It complements, not replaces, our existing RPC calls, and provides a straightforward migration for updater, menu, and space events.