# Proposal: Make `@sila/mobile` usable on iOS

## Goal
Ship a working iOS app from `packages/mobile` with core workspace flows.

## Current state (from repo)
- `MobileApp.svelte` mounts `SilaApp` with `config={null}`.
- No mobile wrappers exist for `AppFileSystem` or `AppDialogs`.
- Capacitor config and the iOS project are present.
- The package uses Vite + Svelte for the wrapper app.

## Missing components to make iOS work
1) **Mobile `ClientStateConfig` wiring**
   - Provide `fs`, `dialog`, and optional `appVersions`.
   - Initialize with `new ClientState()` like desktop.

2) **Capacitor file system wrapper**
   - Implement `AppFileSystem` using `@capacitor/filesystem`.
   - Map paths to app sandbox (e.g., `Directory.Data`).
   - Handle binary reads/writes for file attachments.

3) **Capacitor dialogs + file selection**
   - Implement `AppDialogs` with `@capacitor/dialog`.
   - Add a file picker flow for importing files.
   - Use native share sheet for export.

4) **Persistence layer for mobile URIs**
   - Extend `createPersistenceLayersForURI` to support a mobile scheme
     (example: `capacitor://<spaceId>`).
   - Store workspace data in the Capacitor filesystem.

5) **iOS permissions + native config**
   - Add Info.plist entries for file access and photo library if used.
   - Add plugin setup in Capacitor for iOS.

## Short implementation plan
1) Add Capacitor plugins: Filesystem, Dialog, Share, Preferences.
2) Create `capacitorFsWrapper.ts` and `capacitorDialogsWrapper.ts`.
3) Wire `MobileApp.svelte` to pass `ClientStateConfig`.
4) Add mobile URI support in `createPersistenceLayersForURI`.
5) Test on iOS: `npm -w packages/mobile run build` then `npx cap sync ios` and open Xcode.

## Acceptance checks
- App launches and creates a workspace on iOS.
- Files can be imported and opened from the workspace.
- Workspace data survives app restart.
