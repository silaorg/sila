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
    this.autoUpdater.autoInstallOnAppQuit = true;
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
  }
}