## Improve Updater: Background Checks, Auto Major/Minor, Patch Bundles

### Goals
- Background-check for updates immediately after app launch; detect both full executables and zip client bundles.
- Auto-download full executables when update is a major/minor bump, then prompt to restart.
- For patch-only updates, download just the renderer bundle zip, then prompt to reload when ready.

### Approach
- Use semver to diff `currentVersion` vs `availableVersion` from the update feed.
- Decide the update path by semver diff:
  - major/minor → Full executable update path (silent download, restart prompt on ready)
  - patch → Bundle update path (download zip bundle, reload prompt on ready)

### Full Executable Update Path (major/minor)
- Trigger on app launch (after a short delay, e.g., 10–20s) to avoid startup contention.
- Use `electron-updater` to `checkForUpdates` and then `downloadUpdate` without user prompt when semver diff is major/minor.
- On `update-downloaded`, show a small modal: “Update ready. Restart to apply?” with actions: Restart Now (calls `autoUpdater.quitAndInstall()`) and Later.
- Respect release channels and signatures as today; no change to code signing configuration.

### Bundle Update Path (patch)
- Treat patch updates as renderer-only bundle refreshes delivered via a signed zip.
- Flow:
  1) Fetch bundle manifest for the latest patch matching the current major.minor.
  2) Download bundle zip to app cache dir; verify checksum/signature.
  3) Unpack to `bundles/<version>` and atomically update a `current` pointer/symlink/manifest.
  4) When ready, show non-blocking prompt: “Update ready. Reload to apply.”
  5) On accept, reload the main BrowserWindow; on decline, keep running and remind next launch.
- Keep last known good bundle for rollback if reload fails.

### Startup Background Check
- On `app.whenReady()`, schedule a background check (e.g., setTimeout 10–20s).
- Single-flight guard to avoid concurrent checks; backoff on errors.
- Low-priority network settings, resumable downloads where supported.

### Decision Logic (high-level pseudocode)
```ts
onAppReady(() => {
  schedule(15s, async () => {
    const info = await updater.checkForUpdates(); // returns version + files
    if (!info || !info.version) return;

    const diff = semverDiff(currentVersion, info.version);
    if (diff === 'major' || diff === 'minor') {
      await updater.downloadFullExecutable(info); // silent
      promptRestartOnDownloaded();
    } else if (diff === 'patch') {
      const bundle = await bundles.fetchLatestPatchManifest(currentMajorMinor);
      await bundles.downloadAndActivate(bundle); // validate + switch pointer
      promptReloadWhenReady();
    }
  });
});
```

### UX & Telemetry
- Minimal, non-intrusive prompts; never block interaction during downloads.
- Record outcomes: found/no-update, type (major/minor/patch), download ms, success/failure, user action (restart/reload/later).

### Safety & Config
- Verify signatures for executables and bundles; enforce checksum match before activation.
- Feature flags/env:
  - `UPDATER_DISABLE_AUTO_MAJOR_MINOR` (default false)
  - `UPDATER_DISABLE_PATCH_BUNDLE` (default false)
  - `UPDATER_STARTUP_DELAY_MS` (default 15000)

### Open Questions
- Bundle source of truth and signing: reuse existing release pipeline or separate CDN + manifest?
- OS nuances (Linux AppImage/RPM/DEB) for auto-download without elevation—any exceptions to handle?
- Metered connections/roaming: should we defer full executable downloads on metered networks?

