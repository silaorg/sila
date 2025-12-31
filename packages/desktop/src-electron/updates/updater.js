import { dialog, BrowserWindow, autoUpdater, ipcMain, app } from 'electron';
import { ElectronUpdater } from './electronUpdater.js';
import { DesktopBuildUpdater } from './desktopBuildUpdater.js';
import { githubReleaseManager } from './githubReleaseManager.js';
import { diff as semverDiff, coerce as semverCoerce } from 'semver';

let electronUpdater = new ElectronUpdater();
let desktopBuildUpdater = new DesktopBuildUpdater();

const CHECK_FOR_UPDATES_INTERVAL = 1000 * 60 * 5;
/** @type {boolean} */
let isCheckingOrUpdating = false;

/**
 * @param {any} payload
 */
function emitUpdateProgress(payload) {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('sila:update:progress', payload);
    }
  } catch (e) {
    // Avoid breaking updater flow if window is unavailable
  }
}

/**
 * Orchestrates updates for two independent things:
 * - Electron auto-update (the executable) via `electron-updater`
 * - "Desktop build" update (a `.zip` with web assets) via our `GitHubReleaseManager`
 *
 * Both are GitHub Releases-backed, but via different mechanisms:
 * - Electron updates: handled by `electron-updater` using its GitHub provider (configured by `build.publish` in
 *   `packages/desktop/package.json`).
 * - Desktop build updates: fetched by us via the GitHub Releases REST API (`api.github.com/.../releases`) and then
 *   downloaded/extracted.
 *
 * Update strategy:
 * - Check both sources.
 * - If Electron has an update and it's a **patch** bump, prefer the matching desktop build (same version) when available.
 * - Otherwise (minor/major, or no matching build), download the full Electron update.
 * - If Electron has no update, we may still fetch the latest desktop build.
 *
 * This file is the coordinator; the actual download/apply logic lives in `ElectronUpdater`
 * and `DesktopBuildUpdater`.
 */

/**
 * Set up the updater (IPC handlers + periodic checks).
 * @param {boolean} isDev
 */
export async function setUpdater(isDev) {

  handleInstallElectronUpdate();

  await checkForUpdates();

  setInterval(checkForUpdates, CHECK_FOR_UPDATES_INTERVAL);
}

function handleInstallElectronUpdate() {
  // IPC: handle install request from renderer
  ipcMain.handle('sila:update:install', async () => {
    try {
      // Quit and install the downloaded update
      electronUpdater.autoUpdater.quitAndInstall();
      return { ok: true };
    } catch (err) {
      console.error('Updater IPC install error:', err);
      return { ok: false, error: String(err) };
    }
  });

  // IPC: handle manual check for updates from renderer
  ipcMain.handle('sila:check-for-updates', async () => {
    try {
      await checkForUpdates();
      return { ok: true };
    } catch (err) {
      console.error('Updater IPC check-for-updates error:', err);
      return { ok: false, error: String(err) };
    }
  });
}

export async function checkForUpdates() {
  if (isCheckingOrUpdating) return;
  isCheckingOrUpdating = true;

  try {
    console.log('Updater / Checking for updates...', { currentVersion: app.getVersion() });
    emitUpdateProgress({ stage: 'checking', percent: null, version: app.getVersion() });

    // Fetch Electron update info and desktop builds concurrently
    const [electronAvailableUpdateVersion, desktopBuilds] = await Promise.all([
      electronUpdater.checkForUpdates(),
      desktopBuildUpdater.getAllBuilds()
    ]);

    // If Electron has an update, decide based on semver whether to prefer desktop build
    if (electronAvailableUpdateVersion) {
      try {
        const currentVersion = semverCoerce(app.getVersion());
        const targetVersion = semverCoerce(electronAvailableUpdateVersion);
        const diff = currentVersion && targetVersion ? semverDiff(currentVersion, targetVersion) : null;

        // If there is no semver diff, treat it as "no Electron update".
        // (electron-updater can surface updateInfo even when you're already on that version.)
        if (!diff) {
          console.log('Updater / Electron update check returned no newer version; skipping Electron download', {
            version: electronAvailableUpdateVersion
          });
          // Continue to optional desktop build flow below.
        } else if (diff === 'patch') {
          // Prefer desktop build whose version matches Electron update version
          const matchingBuild = desktopBuilds.find(b => b.version === electronAvailableUpdateVersion);
          if (matchingBuild) {
            console.log('Updater / Downloading desktop build update (patch)', {
              version: matchingBuild.version
            });
            emitUpdateProgress({ kind: 'desktop-build', stage: 'downloading', percent: 0, version: matchingBuild.version });
            // Ensure DesktopBuildUpdater is primed with the matching build using its public method
            await desktopBuildUpdater.checkForUpdates(matchingBuild.version);
            const ok = await desktopBuildUpdater.downloadUpdate();
            console.log('Updater / Desktop build download finished (patch)', { version: matchingBuild.version, ok });
            emitUpdateProgress({ kind: 'desktop-build', stage: ok ? 'ready' : 'error', percent: ok ? 100 : null, version: matchingBuild.version });
            return;
          }
          
          // Check if desktop build exists locally before falling back to Electron update
          const localBuildExists = await githubReleaseManager.hasBuild(electronAvailableUpdateVersion);
          
          if (localBuildExists) {
            console.log('Updater / Desktop build exists locally, no update needed (patch)', {
              version: electronAvailableUpdateVersion
            });
            // Build already exists locally and protocol handler will use it automatically
            // No need to download, notify, or emit progress - just return silently
            return;
          }
          
          // Fallback to Electron if no matching desktop build found locally or on GitHub
          console.log('Updater / Downloading Electron update (patch fallback)', {
            version: electronAvailableUpdateVersion
          });
          emitUpdateProgress({ kind: 'electron', stage: 'downloading', percent: 0, version: electronAvailableUpdateVersion });
          const ok = await electronUpdater.downloadUpdate();
          console.log('Updater / Electron download finished (patch fallback)', { version: electronAvailableUpdateVersion, ok });
          emitUpdateProgress({ kind: 'electron', stage: ok ? 'ready' : 'error', percent: ok ? 100 : null, version: electronAvailableUpdateVersion });
          return;
        } else {
          // For minor/major diffs (or prereleases), download full Electron package
          console.log('Updater / Downloading Electron update', {
            version: electronAvailableUpdateVersion,
            diff
          });
          emitUpdateProgress({ kind: 'electron', stage: 'downloading', percent: 0, version: electronAvailableUpdateVersion });
          const ok = await electronUpdater.downloadUpdate();
          console.log('Updater / Electron download finished', { version: electronAvailableUpdateVersion, ok });
          emitUpdateProgress({ kind: 'electron', stage: ok ? 'ready' : 'error', percent: ok ? 100 : null, version: electronAvailableUpdateVersion });
          return;
        }
      } catch (e) {
        console.error('Updater / semver decision error, falling back to Electron update:', e);
        console.log('Updater / Downloading Electron update (semver fallback)', {
          version: electronAvailableUpdateVersion
        });
        emitUpdateProgress({ kind: 'electron', stage: 'downloading', percent: 0, version: electronAvailableUpdateVersion });
        const ok = await electronUpdater.downloadUpdate();
        console.log('Updater / Electron download finished (semver fallback)', { version: electronAvailableUpdateVersion, ok });
        emitUpdateProgress({ kind: 'electron', stage: ok ? 'ready' : 'error', percent: ok ? 100 : null, version: electronAvailableUpdateVersion });
        return;
      }
    }

    // If no Electron update, still allow latest desktop build to be fetched (optional)
    if (desktopBuilds && desktopBuilds.length > 0) {
      // Prime and download the latest
      console.log('Updater / Downloading latest desktop build (no Electron update)', {
        version: desktopBuilds[0].version
      });
      emitUpdateProgress({ kind: 'desktop-build', stage: 'downloading', percent: 0, version: desktopBuilds[0].version });
      await desktopBuildUpdater.checkForUpdates(desktopBuilds[0].version);
      const ok = await desktopBuildUpdater.downloadUpdate();
      console.log('Updater / Desktop build download finished (no Electron update)', { version: desktopBuilds[0].version, ok });
      emitUpdateProgress({ kind: 'desktop-build', stage: ok ? 'ready' : 'error', percent: ok ? 100 : null, version: desktopBuilds[0].version });
      return;
    }

    // Nothing to do
    emitUpdateProgress({ stage: 'idle', percent: null });
  } finally {
    isCheckingOrUpdating = false;
  }
}