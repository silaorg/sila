# Desktop Updates Overview

Sila ships two kinds of desktop updates and lets the app decide which one to apply:

- **Executable updates** refresh the Electron bundle itself. We download the latest signed installer from GitHub Releases and hand it off to the user (macOS DMG, Windows EXE, Linux AppImage). After the download completes, the updater relaunches the new build or lets the system installer finish the upgrade.

- **Client bundle swaps** refresh only the web assets (HTML/CSS/JS). The current executable stays in place. We fetch the latest client zip, unpack it under the local `builds/desktop` cache, and reload the app to serve the new files via the custom `sila://client/` protocol. This keeps hotfixes lightweight and avoids forcing users to re-download the entire Electron runtime. Release zips now live directly under `packages/desktop/dist/` (for example `desktop-v1.0.1.zip`).

The smart update coordinator decides which path to take. It compares the running version, the latest tagged release, and the available client-only builds:

1. Ask GitHub for releases and their assets.
2. Pick the best candidate (full app vs. client bundle) using priority rules: major version jumps require the executable; minor or asset-only changes can use the bundled swap.
3. Expose the choice to the renderer process so the Dev Panel can show the reasoning, cached builds, and manual download options.
4. Execute the chosen update flow and report progress back to the UI shell.

For development builds we expose additional state: cached builds, strategy reason, and manual download buttons inside the Dev Panel. Production users see only the relevant flow and messaging.

The updater lives in the desktop package (`packages/desktop/src-electron`) and integrates with the renderer through `window.electronFileSystem`. Renderer code calls a single `checkUpdatesWithStrategy()` entry point; everything else (GitHub access, local caching, and switch-over logic) happens in the main process.

