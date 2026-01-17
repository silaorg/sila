# Proposal: Make `@sila/mobile` usable on iOS (v1)

## Goal
Ship a working iOS app from `packages/mobile` that can open a space and persist it.

## Scope (v1)
- Start the app and render `SilaApp`.
- Create a workspace and reopen it after restart.
- Read and write workspace files in the iOS sandbox.
- Use a basic dialog for confirmations and errors.

## Non-goals (v1)
- No cloud sync.
- No share sheet export.
- No advanced file picker.

## Current state
- `MobileApp.svelte` mounts `SilaApp` with `config={null}`.
- No mobile wrappers exist for `AppFileSystem` or `AppDialogs`.
- Capacitor config and iOS project exist.

## Plan
1) Add a mobile `ClientStateConfig`.
2) Implement a Capacitor filesystem wrapper.
3) Implement a minimal dialogs wrapper.
4) Support a mobile space URI in persistence layers.
5) Run on iOS and validate persistence.

## Implementation details
### 1) Mobile config wiring
- Create `packages/mobile/src/lib/mobileConfig.ts`.
- Build `ClientStateConfig` with:
  - `fs` from the Capacitor filesystem wrapper.
  - `dialogs` from the minimal dialogs wrapper.
  - `appVersions` as a placeholder (return static values).
- In `MobileApp.svelte`, pass the config to `SilaApp` and create a `ClientState`.

### 2) Capacitor filesystem wrapper
- Use `@capacitor/filesystem`.
- Root all data in `Directory.Data`.
- Map space IDs to `spaces/<spaceId>/`.
- Implement:
  - `readFile(path, asBinary)`.
  - `writeFile(path, data)`.
  - `deleteFile(path)`.
  - `readDir(path)`.
  - `ensureDir(path)`.
- Keep APIs async and return errors from the plugin.

### 3) Minimal dialogs wrapper
- Use `@capacitor/dialog` for alerts and confirms.
- Implement:
  - `alert(title, message)`.
  - `confirm(title, message)`.
- Skip file pickers and shares for v1.

### 4) Mobile persistence URI
- Extend `createPersistenceLayersForURI` to support `capacitor://<spaceId>`.
- Route that scheme to the new filesystem wrapper.
- Use the same on-disk layout as desktop, under `Directory.Data`.

### 5) iOS setup
- Add required iOS permissions only if the plugin needs them.
- Ensure `npx cap sync ios` adds the plugins.

## Open questions
- Do we need `@capacitor/preferences` for small settings, or can we store all settings in files?
- Is there a shared `AppFileSystem` interface we should extend for mobile-only methods?

## Acceptance checks
- App launches on iOS and shows the workspace UI.
- Creating a workspace succeeds.
- Workspace data persists after a full restart.

## Test steps
1) `npm -w packages/mobile run build`
2) `npx cap sync ios`
3) Open the iOS project in Xcode and run on simulator.
4) Create a workspace, quit the app, and relaunch.
