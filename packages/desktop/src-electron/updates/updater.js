import { dialog, BrowserWindow, autoUpdater, ipcMain, app } from 'electron';
import { updateCoordinator } from './updateCoordinator.js';
import { ElectronUpdater } from './electronUpdater.js';
import { DesktopBuildUpdater } from './desktopBuildUpdater.js';
import { diff as semverDiff, coerce as semverCoerce } from 'semver';

let electronUpdater = new ElectronUpdater();
let desktopBuildUpdater = new DesktopBuildUpdater();

const CHECK_FOR_UPDATES_INTERVAL = 1000 * 60 * 5;
/** @type {boolean} */
let isCheckingOrUpdating = false;

/**
 * Set up the updater
 * @param {boolean} isDev
 */
export async function setUpdater(isDev) {

  /*
  @TODO:
  - Check for updates - electron package and desktop build
  - Decide whether to update the electron package or the desktop build.
  - If it's only the patch change - we will download the desktop build, otherwise we will download the electron package.
  */

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
}

export async function checkForUpdates() {
  if (isCheckingOrUpdating) return;
  isCheckingOrUpdating = true;

  try {
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

        if (diff === 'patch') {
          // Prefer desktop build whose version matches Electron update version
          const matchingBuild = desktopBuilds.find(b => b.version === electronAvailableUpdateVersion);
          if (matchingBuild) {
            // Ensure DesktopBuildUpdater is primed with the matching build using its public method
            await desktopBuildUpdater.checkForUpdates(matchingBuild.version);
            await desktopBuildUpdater.downloadUpdate();
            return;
          }
          // Fallback to Electron if no matching desktop build found
          await electronUpdater.downloadUpdate();
          return;
        }

        // For minor/major diffs, download full Electron package
        await electronUpdater.downloadUpdate();
        return;
      } catch (e) {
        console.error('Updater / semver decision error, falling back to Electron update:', e);
        await electronUpdater.downloadUpdate();
        return;
      }
    }

    // If no Electron update, still allow latest desktop build to be fetched (optional)
    if (desktopBuilds && desktopBuilds.length > 0) {
      // Prime and download the latest
      await desktopBuildUpdater.checkForUpdates(desktopBuilds[0].version);
      await desktopBuildUpdater.downloadUpdate();
    }
  } finally {
    isCheckingOrUpdating = false;
  }
}