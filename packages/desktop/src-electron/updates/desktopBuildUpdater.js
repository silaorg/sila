// Responsible for downloading the desktop build (.zip with the web assets)
// This is used to update the desktop build if it's not the same as the electron package
import { BrowserWindow } from 'electron';
import { githubReleaseManager } from './githubReleaseManager.js';

export class DesktopBuildUpdater {
  #isDownloading = false;
  
  /**
   * The version of the update if available, otherwise null
   * @type {string | null}
   */
  availableVersion = null;

  /** @type {string | null} */
  #downloadUrl = null;

  constructor() {}

  /**
   * Check for desktop build updates
   * If targetVersion is provided, search for that exact build in recent releases.
   * If not provided, return the latest available desktop build version if any.
   * @param {string | null} targetVersion
   * @returns {Promise<string | null>} available version or null
   */
  async checkForUpdates(targetVersion = null) {
    try {
      if (targetVersion) {
        const builds = await githubReleaseManager.getAllAvailableDesktopBuilds();
        const match = builds.find(b => b.version === targetVersion);
        if (match) {
          this.availableVersion = match.version;
          this.#downloadUrl = match.downloadUrl;
          return this.availableVersion;
        }
        return null;
      }

      const latest = await githubReleaseManager.checkForLatestRelease();
      if (latest && latest.version) {
        this.availableVersion = latest.version;
        this.#downloadUrl = latest.downloadUrl;
        return this.availableVersion;
      }
      return null;
    } catch (e) {
      console.error('DesktopBuildUpdater / checkForUpdates error:', e);
      return null;
    }
  }

  /**
   * Download and extract the desktop build previously discovered in checkForUpdates
   * @returns {Promise<boolean>}
   */
  async downloadUpdate() {
    if (this.#isDownloading) return false;
    if (!this.availableVersion || !this.#downloadUrl) return false;
    this.#isDownloading = true;
    try {
      const ok = await githubReleaseManager.downloadAndExtractBuild(
        this.#downloadUrl,
        this.availableVersion,
        (progress) => {
          try {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('sila:update:progress', {
                kind: 'desktop-build',
                stage: 'downloading',
                version: this.availableVersion,
                percent: progress
              });
            }
          } catch {
            // ignore
          }
        }
      );
      console.log('DesktopBuildUpdater / Download result:', ok);
      return ok;
    } catch (e) {
      console.error('DesktopBuildUpdater / downloadUpdate error:', e);
      return false;
    } finally {
      this.#isDownloading = false;
    }
  }

  /**
   * Get all available desktop builds (newest first)
   * @returns {Promise<Array<{version:string, downloadUrl:string}>>}
   */
  async getAllBuilds() {
    try {
      const builds = await githubReleaseManager.getAllAvailableDesktopBuilds();
      return builds;
    } catch (e) {
      console.error('DesktopBuildUpdater / getAllBuilds error:', e);
      return [];
    }
  }
}