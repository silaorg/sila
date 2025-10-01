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
- Trigger on app launch; no delay.
- Use `electron-updater` to `checkForUpdates` and then `downloadUpdate` without user prompt when semver diff is major/minor.
- On `update-downloaded`, show a small modal: “Update ready. Restart to apply?” with actions: Restart Now (calls `autoUpdater.quitAndInstall()`) and Later.
- Respect release channels and signatures as today; no change to code signing configuration.

### Bundle Update Path (patch)
- Treat patch updates as renderer-only bundle refreshes delivered via a signed zip.
- Flow:
  1) Fetch bundle manifest for the latest patch matching the current major.minor.
  2) Download bundle zip to app cache dir; verify checksum/signature.
  3) Unpack to `bundles/<version>` and update `latestDownloadedBundleVersion` in a manifest (do not switch what we serve yet).
  4) When ready, show non-blocking prompt: “Update ready. Reload to apply.”
  5) On accept, set `targetBundleVersion = latestDownloadedBundleVersion`, atomically update a `current` pointer/symlink/manifest, then reload the main BrowserWindow. On decline, keep running and remind later.
- Keep last known good bundle for rollback if reload fails.

### Target Bundle Version Pinning (deferred activation)
- Maintain a small persisted manifest at `userData/builds/manifest.json`:
  - `activeBundleVersion`: currently loaded bundle (derived at runtime or persisted after successful reload)
  - `targetBundleVersion`: bundle version that the app should serve on next load/reload
  - `latestDownloadedBundleVersion`: highest version fully downloaded and verified locally
- Serving rule: always load from `targetBundleVersion` via a stable path (e.g., `sila://builds/desktop/current/index.html`) where `current` points to `bundles/desktop-v{targetBundleVersion}`.
- Update discovery may download newer bundles in the background and advance `latestDownloadedBundleVersion`, but it must NOT change `targetBundleVersion` automatically.
- When user accepts the prompt, promote `targetBundleVersion = max(latestDownloadedBundleVersion, targetBundleVersion)` and then reload. If newer builds finished downloading while the prompt was open, the promotion applies the newest available.
- Rollback: if reload fails quickly, revert `targetBundleVersion` to previous and reload back.

### Startup Background Check
- On `app.whenReady()`, run a background check immediately (no delay).
- Single-flight guard to avoid concurrent checks; backoff on errors.
- Low-priority network settings, resumable downloads where supported.

### Decision Logic (high-level pseudocode)
```ts
onAppReady(async () => {
  const info = await updater.checkForUpdates(); // returns version + files
  if (!info || !info.version) return;

  const diff = semverDiff(currentVersion, info.version);
  if (diff === 'major' || diff === 'minor') {
    await updater.downloadFullExecutable(info); // silent
    promptRestartOnDownloaded();
  } else if (diff === 'patch') {
    const latestAvailable = await bundles.fetchLatestPatchManifest(currentMajorMinor);
    await bundles.downloadIfNeeded(latestAvailable); // validate, extract; updates latestDownloadedBundleVersion
    if (manifest.latestDownloadedBundleVersion > manifest.targetBundleVersion) {
      promptReloadWhenReady({ onAccept: () => {
        manifest.targetBundleVersion = manifest.latestDownloadedBundleVersion; // promote target explicitly
        bundles.pointCurrentToTarget(manifest.targetBundleVersion); // atomic symlink/manifest update
        reloadMainWindow();
      }});
    }
  }
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

### Open Questions
- Bundle source of truth and signing: reuse existing release pipeline or separate CDN + manifest?
- OS nuances (Linux AppImage/RPM/DEB) for auto-download without elevation—any exceptions to handle?
- Metered connections/roaming: should we defer full executable downloads on metered networks?

