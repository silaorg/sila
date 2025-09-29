# Download and Swap Builds on Mobile (Capacitor)

## Goal

Ship a stable native shell (Capacitor) while making it easy for us to update only the client bundle (HTML/JS/CSS) at runtime. Keep it simple: versioned folders, a lightweight selection rule (pick newest compatible), and platform‑appropriate resource serving. No symlinks; no native code updates. We already follow this pattern on desktop; this proposal adapts the same ideas for mobile.

—

## Scope

- Update renderer UI assets independently of the installed app from App Store/Play Store
- Native shell (plugins, entitlements, WebView settings) remains signed and rarely changes
- Works on iOS and Android with Capacitor

—

## High-level architecture

Two layers:
1) Shell (frozen): Capacitor app + plugins; WebView config; security
2) Build bundles (mutable): versioned web bundles with `index.html`, JS, CSS, assets

Key principle: Renderer loads from a writable cache path, or falls back to the embedded seed bundle inside the app package when no cache exists.

—

## Storage layout (no symlinks)

- Writable root: `…/builds/`
- Inside: `v1.4.2/`, `v1.5.0/`, `v1.5.1/` … (semver)
- Selection rule: list subfolders that look like `vX.Y.Z`, sort by semver, pick the highest within compatibility bounds
- Optional `previousVersion` file for rollback heuristics

Locations
- iOS: `FilesystemDirectory.Data` (App sandbox, e.g., Library/Application Support)
- Android: `FilesystemDirectory.Data` (app-specific internal storage)

—

## Boot sequence

1) Discover bundle
   - List folders under `…/builds/` → pick latest compatible
   - If none exist, use the embedded seed bundle packaged with the app
2) Load UI
   - Point WebView to `sila://builds/mobile/v1.5.1/index.html` (custom scheme) or `file:///…` path handled by a resource loader
3) Health check
   - Renderer self-test (handshake with native bridge, required endpoints reachable). If it fails and an older bundle exists, auto-select the next-latest and continue

—

## Update flow (simple)

1) Fetch manifest from update endpoint: `{ version, url, sha256, signature, minShellVersion, maxShellVersion }`
2) If `version` > current and compatible:
   - Download archive to temp, verify checksum + signature, then unpack to `…/builds/vX.Y.Z/`
3) Switch bundle (seamless)
- Update current build version setting; subsequent navigations/resource requests use the new bundle
   - No user notification required (optional toast in debug builds)

Rollback
- Keep N most recent bundles (e.g., N=3)
- If first-run health check fails, auto-select previous version and continue

—

## Security model (must-haves)

- Bundles are web content only (HTML/CSS/JS) loaded in WebView; no native code
- Strict Content Security Policy; no `eval`; restrict remote origins
- Verify `sha256` + signature before unpacking
- Use `capacitor://`/custom scheme with a controlled allowlist
- App Store rules: this is allowed as long as content runs in WebKit/WebView and does not add executable native code or interpret downloaded code outside the WebView

—

## Platform specifics

### iOS (WKWebView)

- Use `WKURLSchemeHandler` via a Capacitor plugin to handle `sila://builds/mobile/...`
- Resolve `sila://builds/mobile/vX.Y.Z/...` to files under `FilesystemDirectory.Data/builds/vX.Y.Z/`
- Fallback to embedded seed: resolve `sila://builds/mobile/embedded/...` to files in the app bundle (e.g., `Bundle.main.url(forResource:)`)
- Enforce CSP and MIME types; support range requests if needed for media

### Android (WebView)

- Use `shouldInterceptRequest` (or a custom asset loader) to serve `sila://builds/mobile/...`
- Map `…/builds/vX.Y.Z/...` to internal app storage under `Context.getFilesDir()`
- Fallback to embedded seed in `assets/` or `res/raw/`
- Add CSP headers and correct MIME types

—

## Embedded seed bundle

Option A. Serve in place (recommended start)
- Ship the built `www/` (Capacitor web assets) as the embedded seed
- When no cached builds exist, load `sila://builds/mobile/embedded/index.html` directly from the app package

Option B. Extract once to cache
- On first launch, copy `www/` to `…/builds/v<seed>/` for a unified code path and rollback safety

—

## Operational policies

- Retention: keep last 3–5 bundles; GC on idle
- Compatibility: bundle declares `minShellVersion`; if too new, show a friendly “App needs an update” dialog and fall back to newest compatible
- Telemetry guardrails (optional): staged rollout flags, auto‑pause on error spikes

—

## Minimal responsibilities

Shell (Capacitor)
- Load latest compatible bundle from cache or embedded seed
- Verify + unpack updates
- Enforce security (CSP, scheme allowlist)
- Manage retention and rollback

Update service
- Serve signed manifests and immutable archives per version
- Optional rollout/flags

—

## Example URLs and selection

- List: `sila://builds/mobile/` → JSON `{ versions: ["embedded", "v1.5.0", "v1.5.1"] }`
- Load: `sila://builds/mobile/v1.5.1/index.html`
- Fallback: `sila://builds/mobile/embedded/index.html`

—

## Implementation sketch (Capacitor)

1) Bundle structure
```
builds/
  v1.5.0/
    index.html
    assets/
    ...
  v1.5.1/
    ...
  previousVersion
```

2) Native resource handlers
- iOS plugin with `WKURLSchemeHandler` for `sila://builds/mobile/...`
- Android WebView setup intercepting `sila://builds/mobile/...`

3) JS bootstrap
- Determine current version (from storage) → navigate to `sila://builds/mobile/<version>/index.html`
- If not set → use `embedded`

4) Update pipeline
- Check manifest → download → verify → unpack → set current version → seamless use on next navigation/resource

—

## Notes

- Keep updates web-only (HTML/CSS/JS). Any native capability changes still require a store update
- If using service workers, scope them under the versioned path to avoid cache collisions

