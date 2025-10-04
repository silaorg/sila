import { BrowserWindow, dialog } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

/**
 * Responsible updating the electron executable (needs to restart the app to apply)
 */
export class ElectronUpdater {

  /**
   * The version of the update if available, otherwise null
   * @type {string | null}
   */
  availableVersion = null;

  #isDownloading = false;
  
  constructor() {
    this.autoUpdater = autoUpdater;
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = true;

    // Helpful logs and future hooks
    this.autoUpdater.on('update-available', (info) => {
      console.log('ElectronUpdater / update-available:', info?.version);
    });
    this.autoUpdater.on('update-not-available', (info) => {
      console.log('ElectronUpdater / update-not-available:', info?.version);
    });
    this.autoUpdater.on('update-downloaded', (event) => {
      console.log('ElectronUpdater / update-downloaded:', event?.version);
    });
    this.autoUpdater.on('error', (err) => {
      console.error('ElectronUpdater / error:', err);
    });
  }

  /**
   * Check for updates
   * @returns {Promise<string | null>} The version of the update if available, otherwise null
   */
  async checkForUpdates() {
    console.log('ElectronUpdater / Current version:', this.autoUpdater.currentVersion);

    const result = await this.autoUpdater.checkForUpdates();
    console.log('ElectronUpdater / CheckForUpdates result:', result);
    
    const version = result?.updateInfo.version;
    console.log('ElectronUpdater / CheckForUpdates version:', version);
    this.availableVersion = version ?? null;

    return this.availableVersion;
  }

  async downloadUpdate() {
    if (this.#isDownloading) {
      return;
    }
    this.#isDownloading = true;
    console.log('ElectronUpdater / Downloading update...');
    const downloadedFiles = await this.autoUpdater.downloadUpdate();
    console.log('ElectronUpdater / Update downloaded, files:', downloadedFiles);
    this.#isDownloading = false;

    // Notify renderer that the update has been downloaded
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('sila:update:downloaded', {
          version: this.availableVersion
        });
      }
    } catch (err) {
      console.error('ElectronUpdater / Failed to notify renderer about downloaded update:', err);
    }

    //this.autoUpdater.quitAndInstall();
  }

  showInstallDialog(/** @type {any} */ info) {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Sila ${info.version} has been downloaded and is ready to install.`,
      detail: 'The app will restart to install the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
}