import { dialog, BrowserWindow, autoUpdater } from 'electron';
import { updateCoordinator } from './updateCoordinator.js';
import { ElectronUpdater } from './electronUpdater.js';

let electronUpdater = new ElectronUpdater();

/**
 * Set up the updater
 * @param {boolean} isDev
 */
export async function setUpdater(isDev) {

  await checkForUpdates();
  
  /*
  TODO:
  - Check for updates - executable and build
  - Decide whether to update the electron package or the desktop build.
  - Download the electron package with autoUpdater.downloadUpdate 
  - Download the desktop build with 
  */

  // @TODO: set periodic check for updates
}

export async function checkForUpdates() {
  const electronAvailableUpdateVersion = await electronUpdater.checkForUpdates();

  if (electronAvailableUpdateVersion) {
    electronUpdater.downloadUpdate();
  }

} 

function showInstallDialog(/** @type {any} */ info) {
  /*
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) return;

  // Check if we can show dialog (prevent multiple dialogs)
  if (!updateCoordinator.canShowDialog()) {
    console.log('Update dialog already shown, skipping');
    return;
  }

  updateCoordinator.setDialogShown(true);

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Sila ${info.version} has been downloaded and is ready to install.`,
    detail: 'The app will restart to install the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    updateCoordinator.setDialogShown(false);
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
  */
}