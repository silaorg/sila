import { dialog, BrowserWindow, autoUpdater, ipcMain } from 'electron';
import { updateCoordinator } from './updateCoordinator.js';
import { ElectronUpdater } from './electronUpdater.js';

let electronUpdater = new ElectronUpdater();

const CHECK_FOR_UPDATES_INTERVAL = 1000 * 60 * 5;

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
  const electronAvailableUpdateVersion = await electronUpdater.checkForUpdates();

  if (electronAvailableUpdateVersion) {
    electronUpdater.downloadUpdate();
  }
}