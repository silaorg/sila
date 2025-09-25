# Download and Swap Clients on Desktop

## Goal

Ship a small, stable Electron shell while updating only the client bundle (HTML/JS/CSS) at runtime. Keep it **simple**: no symlinks, just versioned folders and a lightweight selection rule (pick the newest version within compatibility bounds). Avoid deep code—focus on flow and responsibilities.

This approach allows Sila to deliver rapid client updates without requiring full app reinstalls, while maintaining the security and stability of the Electron shell.

---

## Scope

* Client UI assets (Svelte components, CSS, JS) update independently of the installed binary
* Electron shell (main process, preload, IPC allowlist, security settings) remains signed and rarely changes
* Works for both installed and portable distributions
* Maintains Sila's current architecture: client package + core package + desktop wrapper

---

## High-level architecture

**Two layers**

1. **Shell (frozen):** Electron main process, preload scripts, IPC handlers, security settings, native integrations (file system, dialogs, space management). Updates via normal installers when needed.
2. **Client bundles (mutable):** Versioned folders containing the built client assets (HTML, JS, CSS, static files). Downloaded and stored in a writable location.

**Key principle:** The renderer runs from a **writable cache path** *or* from the **embedded seed bundle** inside the app when no cache exists.

---

## Sila-specific considerations

### Current Sila Architecture
- **Desktop package**: Thin Electron wrapper that imports `@sila/client` and `@sila/core`
- **Client package**: Svelte components and UI logic  
- **Core package**: Business logic, RepTree CRDT, persistence layers
- **Build process**: 
  1. `prepare-static-files`: Copies client static files to `static-compiled/`
  2. `build -w @sila/client`: Builds client package (generates `compiled-style.css`)
  3. `vite build`: Builds desktop app with Vite, outputs to `build/` directory
  4. Electron packages the `build/` directory

### Current Build Output Structure
```
build/
├── index.html                    # Main HTML entry point
├── assets/
│   ├── index-B6P78SKR.js        # Main JS bundle (1.5MB)
│   ├── index-BGeEc107.css       # Main CSS bundle (361KB)
│   └── [hundreds of other assets] # Language syntax files, themes, etc.
├── auth-providers-icons/         # Static assets
├── providers/                    # Provider logos
└── [other static files]          # Icons, favicons, etc.
```

### Client Bundle Contents
Each client bundle will contain:
- Built Svelte components and compiled CSS
- Static assets (icons, images, provider logos, auth icons)
- `index.html` entry point
- Version metadata
- Compatibility information (minimum shell version)

### Storage layout (no symlinks)

* Writable root: `…/bundles/`
* Inside: multiple versioned dirs: `client-v1.0.1/`, `client-v1.0.2/`, `client-v1.1.0/` …
* **Selection rule:** read all subfolders that look like `client-vx.y.z`, sort by semver, pick the **highest** as **current** within compatibility bounds
* Keep a small `previousVersion` file (optional) for rollback heuristics

**Locations**

* **Installed build:** `app.getPath('userData')/bundles/`
* **Portable build:** near the executable (e.g., `./data/bundles/` on Win/Linux; on macOS, a writable sibling folder next to `Sila.app`, not inside it)

---

## Boot sequence

1. **Discover bundle:**
   * List folders under `…/bundles/` → if any, pick the latest compatible version
   * If none exist, fall back to the **embedded seed bundle** that ships with the app package
2. **Load UI:**
   * Point the BrowserWindow to `file://<bundlePath>/index.html` (or use the existing `electron-serve` mechanism)
3. **Health check:**
   * Renderer self-test (e.g., version handshake with preload, required endpoints reachable). If it fails and an older bundle exists, optionally prompt to roll back

---

## Update flow (simple)

1. **Check manifest** from our update endpoint: `{ version, url, sha256, signature, minShellVersion, maxShellVersion }`
2. If `version` > currently loaded version and compatibility checks pass:
   * Download bundle to temp, verify checksum + signature, then unpack to `…/bundles/client-<version>/`
3. **Switching bundles:**
   * After unpacking, update the current client version setting
   * The next time the app loads a resource, it automatically uses the new bundle
   * No user notification needed - seamless update

**UX example**
* User continues working normally
* New client version loads automatically on next page navigation or resource request
* No interruption to user workflow

---

## Rollback (minimalist)

* Keep the N most recent bundles (e.g., N=3)
* If the latest fails the health check on first run, auto-select the next-latest bundle and show a notification ("Reverted to client-v1.5.0 due to startup error")

---

## Security model (must-haves)

* Client bundles are **untrusted**:
  * `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
  * Strict **IPC allowlist** via `contextBridge` (no arbitrary `invoke`)
  * **CSP** disallowing inline/eval; restrict remote origins tightly
  * Verify **sha256 + signature** before unpacking any downloaded bundle
* Keep **preload** and any native modules **inside the signed app**; not updatable via bundles
* App Store caveat: Mac App Store forbids executing downloaded code → this model is for non‑MAS distribution

---

## Embedded seed bundle: options

**A. Serve directly from the package (no extraction)**
* Ship the built `build/` directory in the Electron package (already done)
* On first boot (and whenever no cache is present), serve from the embedded `build/` directory via `sila://` protocol
* Pros: zero copy, simplest first-run, no additional packaging needed
* Cons: cannot be modified; still fine because it's only a fallback

**B. Extract once to the cache**
* On first boot, copy/unzip the seed into `…/bundles/client-<seedVersion>/`
* Pros: consistent code path for loading (always from cache), enables rollback to seed
* Cons: adds one-time copy

**Recommendation:** Start with **A** (serve-in-place) for simplicity. The existing `build/` directory is already packaged with the Electron app, so we just need to serve it via the `sila://` protocol when no client bundle is available.

---

## Portable mode

* Prefer a `--portable` flag or presence of `portable.json` next to the executable to switch the bundles root
* Windows/Linux: `./data/bundles/` next to the exe
* macOS: `Sila/` folder containing `Sila.app` and a writable sibling `AppData/bundles/`

---

## Operational policies

* **Retention:** keep last 3–5 bundles, GC older ones on idle
* **Telemetry guardrails:** staged rollout (e.g., 10% → 100%), auto‑pause if crash rate or startup failures spike on the latest bundle
* **Version compatibility:** client checks for a minimum shell version; if too new, show a friendly "App needs an update" dialog and fall back to the newest compatible bundle

---

## Minimal responsibilities

**Shell**
* Load latest compatible bundle from cache or seed
* Verify + unpack updates
* Enforce security (sandbox, IPC allowlist, CSP)
* Manage retention and rollback heuristics

**Update service**
* Serve signed manifests and bundle archives
* Keep immutable bundles per version
* Optionally, expose rollout percentages/flags

---

## Implementation details for Sila

### Current build process modifications
1. **Desktop build**: Continue building as normal, but also create a "client bundle" output
2. **Client bundle creation**: Extract the built client assets into a versioned folder structure
3. **Embedded seed**: Include the current client build as a fallback in the Electron app

### Key changes needed

#### 1. Modify build process
```bash
# Current build process
npm run prepare-static-files && npm run build -w @sila/client && npm run build:vite

# New: Also create client bundle
npm run build:client-bundle  # New script to create versioned client bundle
```

#### 2. Extend sila:// protocol for client bundles
```javascript
// Current: Uses electron-serve to load from build/ directory
serveURL(mainWindow);

// New: Use sila:// protocol with versioned client API
// Instead of: serveURL(mainWindow);
// Use: mainWindow.loadURL('sila://clients/v1.0.3/index.html');

// The sila:// protocol would handle:
// sila://clients/                    # List available client versions
// sila://clients/v1.0.3/index.html  # Main app entry point
// sila://clients/v1.0.3/assets/app.js # JS bundles
// sila://clients/v1.0.3/assets/app.css # CSS bundles
// sila://clients/v1.0.3/favicon.ico   # Static assets
```

#### 3. Extend fileProtocol.js
```javascript
// Current: Only handles sila://spaces/{spaceId}/files/{hash}
// New: Also handle sila://clients/{version}/{path}

protocol.handle('sila', async (request) => {
  const url = new URL(request.url);
  
  if (url.hostname === 'spaces') {
    // Existing space file handling
    return handleSpaceFile(request);
  } else if (url.hostname === 'clients') {
    // New: Handle client bundle files
    return handleClientFile(request);
  }
  
  return new Response('Invalid hostname', { status: 400 });
});

async function handleClientFile(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  if (pathParts.length === 0) {
    // sila://clients/ - List available client versions
    return listAvailableClients();
  }
  
  const version = pathParts[0];
  const filePath = pathParts.slice(1).join('/');
  
  // Get the client bundle path for this version
  const clientBundlePath = getClientBundlePath(version);
  
  if (!clientBundlePath) {
    return new Response('Client version not found', { status: 404 });
  }
  
  const fullPath = path.join(clientBundlePath, filePath);
  
  // Check if file exists
  const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
  if (!fileExists) {
    return new Response('File not found', { status: 404 });
  }
  
  // Serve the file with appropriate MIME type
  return serveFile(fullPath);
}

async function listAvailableClients() {
  const bundlesDir = path.join(app.getPath('userData'), 'bundles');
  const versions = await fs.readdir(bundlesDir).catch(() => []);
  
  // Add embedded version
  versions.push('embedded');
  
  return new Response(JSON.stringify({ versions }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function getClientBundlePath(version) {
  if (version === 'embedded') {
    return path.join(__dirname, 'build');
  }
  
  const bundlesDir = path.join(app.getPath('userData'), 'bundles');
  return path.join(bundlesDir, `client-v${version}`);
}
```

#### 4. Update electronWindow.js
```javascript
// Current: Always loads from build/ directory
serveURL(mainWindow);

// New: Load from specific client version
const clientVersion = getCurrentClientVersion(); // e.g., 'v1.0.3' or 'embedded'
const serveClient = serve({ directory: getClientBundlePath(clientVersion) });
serveClient(mainWindow);

// Or even simpler:
mainWindow.loadURL(`sila://clients/${clientVersion}/index.html`);

// For seamless updates, we can also update the serve function:
function updateClientVersion(newVersion) {
  const newServeClient = serve({ directory: getClientBundlePath(newVersion) });
  // The next resource request will use the new version
  // No need to reload the window!
}
```

#### 5. IPC additions needed
```javascript
// New IPC handlers for client bundle management
ipcMain.handle('check-client-update', async (event) => {
  // Check for available client updates
});

ipcMain.handle('download-client-update', async (event, version) => {
  // Download and verify new client bundle
});

ipcMain.handle('switch-client-bundle', async (event, version) => {
  // Switch to a different client bundle version
  // This updates the current version setting
  // Next resource request will use the new version
  updateCurrentClientVersion(version);
});

ipcMain.handle('get-current-client-version', async (event) => {
  // Get currently loaded client version
});

ipcMain.handle('list-available-clients', async (event) => {
  // List available client versions
  return fetch('sila://clients/').then(r => r.json());
});
```

### Bundle structure
```
bundles/
├── client-v1.0.1/
│   ├── index.html                    # Main entry point
│   ├── assets/
│   │   ├── index-B6P78SKR.js        # Main JS bundle
│   │   ├── index-BGeEc107.css       # Main CSS bundle
│   │   └── [hundreds of other assets] # Language files, themes, etc.
│   ├── auth-providers-icons/         # Static assets
│   ├── providers/                    # Provider logos
│   ├── favicon.ico                   # Icons
│   └── metadata.json                 # Version and compatibility info
├── client-v1.0.2/
│   └── ...
└── previousVersion
```

### Compatibility matrix
```json
{
  "version": "1.0.1",
  "minShellVersion": "1.0.0",
  "maxShellVersion": "2.0.0",
  "features": ["spaces", "chat", "files"],
  "dependencies": {
    "core": "^1.0.0"
  },
  "buildHash": "abc123...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Client bundle creation script
```bash
#!/bin/bash
# packages/desktop/scripts/create-client-bundle.sh

VERSION=$1
BUNDLE_DIR="bundles/client-v${VERSION}"

# Create bundle directory
mkdir -p "$BUNDLE_DIR"

# Copy build output to bundle
cp -r build/* "$BUNDLE_DIR/"

# Create metadata
cat > "$BUNDLE_DIR/metadata.json" << EOF
{
  "version": "$VERSION",
  "minShellVersion": "1.0.0",
  "maxShellVersion": "2.0.0",
  "features": ["spaces", "chat", "files"],
  "dependencies": {
    "core": "^1.0.0"
  },
  "buildHash": "$(git rev-parse HEAD)",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Client bundle created: $BUNDLE_DIR"
```

---

## Example: switching after download (step-by-step)

1. App finds update client-v1.5.1 → downloads → verifies → unpacks to `…/bundles/client-v1.5.1/`
2. App updates the current client version setting to `v1.5.1`
3. Next time the app loads a resource (JS, CSS, image), it automatically serves from the new bundle
4. User continues working with the updated client - no interruption
5. If the new bundle fails health checks, automatically fall back to the previous version

---

## What we won't do (v1)

* No differential patches (full bundles only)
* No background process beyond the app itself (keep updater simple inside the shell)
* No symlinks or registry tricks; pure folder listing + semver sort
* No changes to core package (business logic remains in the shell)

---

## Open questions

* Do we want service workers inside bundles for offline caching (local path)?
* Rollout controls: do we need staged rollout knobs on the server now or later?
* Error budget: what's acceptable failure rate before auto‑rollback triggers?
* How to handle core package updates that require shell changes?
* Should we version the core package separately or bundle it with the client?

---

## Benefits for Sila

1. **Rapid iteration**: UI/UX changes can be deployed without full app updates
2. **Reduced download size**: Users only download client changes, not the entire Electron app
3. **A/B testing**: Easy to test different client versions with staged rollouts
4. **Rollback safety**: Quick reversion if a client update causes issues
5. **Development workflow**: Developers can test client changes without rebuilding the entire desktop app
6. **Preserves existing architecture**: No changes to core package, client package, or Electron shell
7. **Leverages existing build system**: Uses current Vite + Electron setup
8. **Unified protocol**: Uses existing `sila://` protocol instead of `electron-serve`
9. **Better security**: Custom protocol gives more control over file serving
10. **Consistent with existing patterns**: Follows the same pattern as space file serving
11. **Versioned API**: `sila://clients/` provides a clean API for client management
12. **Flexible serving**: Can use either `electron-serve` or direct `sila://` URLs
13. **Easy debugging**: Can inspect available clients via `sila://clients/`

## Implementation roadmap

### Phase 1: Basic client bundle system
1. Create client bundle creation script
2. Extend `sila://` protocol to handle client bundles
3. Modify `electronWindow.js` to use `sila://client/index.html`
4. Add basic IPC handlers for bundle management
5. Test with manual bundle switching

### Phase 2: Update mechanism
1. Implement update checking and downloading
2. Add bundle verification and security
3. Implement seamless client switching
4. Add automatic rollback on failure

### Phase 3: Production features
1. Staged rollouts and telemetry
2. Bundle retention policies
3. Compatibility checking
4. Performance optimizations

This approach maintains Sila's current architecture while enabling much faster client-side updates and improvements.