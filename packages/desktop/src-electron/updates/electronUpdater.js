import { BrowserWindow, dialog } from 'electron';
import pkg from 'electron-updater';
import { diff as semverDiff, coerce as semverCoerce } from 'semver';
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
    this.autoUpdater.on('download-progress', (progress) => {
      try {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('sila:update:progress', {
            kind: 'electron',
            stage: 'downloading',
            version: this.availableVersion,
            percent: typeof progress?.percent === 'number' ? Math.round(progress.percent) : null,
            transferred: progress?.transferred,
            total: progress?.total,
            bytesPerSecond: progress?.bytesPerSecond
          });
        }
      } catch {
        // ignore
      }
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
    const current = semverCoerce(this.autoUpdater.currentVersion?.version);
    const target = semverCoerce(version);
    const diff = current && target ? semverDiff(current, target) : null;

    // electron-updater may still return updateInfo with a version even when no update is available.
    // Treat "no semver diff" as "no update".
    this.availableVersion = diff ? (version ?? null) : null;

    return this.availableVersion;
  }

  async downloadUpdate() {
    if (this.#isDownloading) return false;

    this.#isDownloading = true;
    try {
      console.log('ElectronUpdater / Downloading update...', { version: this.availableVersion });
      const downloadedFiles = await this.autoUpdater.downloadUpdate();
      console.log('ElectronUpdater / Update downloaded', {
        version: this.availableVersion,
        filesCount: Array.isArray(downloadedFiles) ? downloadedFiles.length : undefined
      });

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

      return true;
    } catch (err) {
      console.error('ElectronUpdater / downloadUpdate error:', err);
      return false;
    } finally {
      this.#isDownloading = false;
    }
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