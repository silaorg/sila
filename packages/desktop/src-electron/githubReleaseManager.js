import { app, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import https from 'https';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { createReadStream } from 'fs';
import AdmZip from 'adm-zip';
import { updateCoordinator } from './updateCoordinator.js';

/**
 * GitHub Release Manager for downloading and managing desktop builds
 * Handles checking for latest releases and downloading desktop-v{version}.zip files
 */
export class GitHubReleaseManager {
  constructor() {
    this.owner = 'silaorg'; // From package.json build.publish
    this.repo = 'sila'; // From package.json build.publish
    this.currentVersion = app.getVersion();
  }

  /**
   * Resolve builds directory dynamically to respect app.setName timing
   */
  getBuildsDir() {
    return path.join(app.getPath('userData'), 'builds');
  }

  /**
   * Check for latest GitHub release
   * @returns {Promise<{version: string, downloadUrl: string, publishedAt: string} | null>}
   */
  async checkForLatestRelease() {
    // Check if we can check for client updates (no full app update in progress)
    if (!updateCoordinator.canCheckClientUpdates()) {
      console.log('Skipping client bundle update check - full app update in progress');
      return null;
    }

    try {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`;
      
      const response = await this.makeHttpRequest(url);
      const release = JSON.parse(response);
      
      // Look for desktop-v{version}.zip asset
      const desktopAsset = release.assets.find(asset => 
        asset.name.startsWith('desktop-v') && asset.name.endsWith('.zip')
      );
      
      if (!desktopAsset) {
        console.log('No desktop build found in latest release, checking recent releases...');
        return await this.findDesktopBuildInRecentReleases();
      }
      
      // Extract version from asset name (desktop-v1.2.3.zip -> 1.2.3)
      const versionMatch = desktopAsset.name.match(/desktop-v(.+)\.zip$/);
      if (!versionMatch) {
        console.log('Could not extract version from asset name:', desktopAsset.name);
        return await this.findDesktopBuildInRecentReleases();
      }
      
      const version = versionMatch[1];
      
      return {
        version,
        downloadUrl: desktopAsset.browser_download_url,
        publishedAt: release.published_at,
        assetName: desktopAsset.name,
        size: desktopAsset.size
      };
    } catch (error) {
      console.error('Error checking for latest release:', error);
      return null;
    }
  }

  /**
   * Find desktop build in recent releases (fallback when latest doesn't have one)
   * @returns {Promise<{version: string, downloadUrl: string, publishedAt: string} | null>}
   */
  async findDesktopBuildInRecentReleases() {
    try {
      console.log('Searching recent releases for desktop builds...');
      
      // Get recent releases (last 10)
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases?per_page=10&page=1`;
      
      const response = await this.makeHttpRequest(url);
      const releases = JSON.parse(response);
      
      // Look through releases for desktop builds
      for (const release of releases) {
        const desktopAsset = release.assets.find(asset => 
          asset.name.startsWith('desktop-v') && asset.name.endsWith('.zip')
        );
        
        if (desktopAsset) {
          // Extract version from asset name
          const versionMatch = desktopAsset.name.match(/desktop-v(.+)\.zip$/);
          if (versionMatch) {
            const version = versionMatch[1];
            
            console.log(`Found desktop build in release ${release.tag_name}: ${desktopAsset.name}`);
            
            return {
              version,
              downloadUrl: desktopAsset.browser_download_url,
              publishedAt: release.published_at,
              assetName: desktopAsset.name,
              size: desktopAsset.size,
              releaseTag: release.tag_name,
              isFromRecentRelease: true
            };
          }
        }
      }
      
      console.log('No desktop builds found in recent releases');
      return null;
    } catch (error) {
      console.error('Error searching recent releases:', error);
      return null;
    }
  }

  /**
   * Download and extract a build from GitHub release
   * @param {string} downloadUrl - URL to download the zip file
   * @param {string} version - Version string for the build
   * @returns {Promise<boolean>} Success status
   */
  async downloadAndExtractBuild(downloadUrl, version) {
    // Check if we can download client updates
    if (!updateCoordinator.canCheckClientUpdates()) {
      console.log('Skipping client bundle download - full app update in progress');
      return false;
    }

    // Mark client bundle update as in progress
    updateCoordinator.setClientBundleUpdate(true);

    let tempZipPath = null;
    try {
      const buildName = `desktop-v${version}`;
      const buildsDir = this.getBuildsDir();
      const buildDir = path.join(buildsDir, buildName);
      tempZipPath = path.join(buildsDir, `${buildName}.zip`);
      
      // Check if build already exists
      const buildExists = await fs.access(buildDir).then(() => true).catch(() => false);
      if (buildExists) {
        console.log(`Build ${buildName} already exists, skipping download`);
        return true;
      }
      
      // Ensure builds directory exists
      await fs.mkdir(buildsDir, { recursive: true });
      
      // Download the zip file
      console.log(`Downloading build from: ${downloadUrl}`);
      await this.downloadFile(downloadUrl, tempZipPath);
      
      // Verify zip file was downloaded and has content
      const zipStats = await fs.stat(tempZipPath);
      if (zipStats.size === 0) {
        throw new Error('Downloaded zip file is empty');
      }
      
      // Extract the zip file
      console.log(`Extracting build to: ${buildDir}`);
      await this.extractZipFile(tempZipPath, buildDir);
      
      // Verify that index.html exists
      const indexPath = path.join(buildDir, 'index.html');
      const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
      
      if (!indexExists) {
        throw new Error('Downloaded build does not contain index.html');
      }
      
      // Clean up temp zip file
      await fs.unlink(tempZipPath);
      tempZipPath = null;
      
      console.log(`Successfully downloaded and extracted build: ${buildName}`);
      updateCoordinator.setClientBundleUpdate(false);
      return true;
    } catch (error) {
      console.error('Error downloading and extracting build:', error);
      
      // Clean up temp zip file if it exists
      if (tempZipPath) {
        try {
          await fs.unlink(tempZipPath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp zip file:', cleanupError);
        }
      }
      
      updateCoordinator.setClientBundleUpdate(false);
      return false;
    }
  }

  /**
   * Get list of available builds
   * @returns {Promise<string[]>} Array of build names
   */
  async getAvailableBuilds() {
    try {
      // Ensure builds directory exists; if not, create it and return empty list
      try {
        await fs.mkdir(this.getBuildsDir(), { recursive: true });
      } catch { /* noop */ }

      const entries = await fs.readdir(this.getBuildsDir(), { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('desktop-v'))
        .map(entry => entry.name)
        .sort((a, b) => {
          // Sort by version (simple string comparison should work for semver)
          const versionA = a.replace('desktop-v', '');
          const versionB = b.replace('desktop-v', '');
          return versionB.localeCompare(versionA, undefined, { numeric: true });
        });
    } catch (error) {
      // If directory truly doesn't exist or is inaccessible, surface an empty list
      return [];
    }
  }

  /**
   * Get all available desktop builds from recent GitHub releases
   * @returns {Promise<Array<{version: string, downloadUrl: string, publishedAt: string, releaseTag: string}>>}
   */
  async getAllAvailableDesktopBuilds() {
    try {
      console.log('Fetching all available desktop builds from recent releases...');
      
      // Get recent releases (last 20 to have more options)
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases?per_page=20&page=1`;
      
      const response = await this.makeHttpRequest(url);
      const releases = JSON.parse(response);
      
      const desktopBuilds = [];
      
      // Look through releases for desktop builds
      for (const release of releases) {
        const desktopAsset = release.assets.find(asset => 
          asset.name.startsWith('desktop-v') && asset.name.endsWith('.zip')
        );
        
        if (desktopAsset) {
          // Extract version from asset name
          const versionMatch = desktopAsset.name.match(/desktop-v(.+)\.zip$/);
          if (versionMatch) {
            const version = versionMatch[1];
            
            desktopBuilds.push({
              version,
              downloadUrl: desktopAsset.browser_download_url,
              publishedAt: release.published_at,
              releaseTag: release.tag_name,
              assetName: desktopAsset.name,
              size: desktopAsset.size
            });
          }
        }
      }
      
      // Sort by version (newest first)
      desktopBuilds.sort((a, b) => {
        return b.version.localeCompare(a.version, undefined, { numeric: true });
      });
      
      console.log(`Found ${desktopBuilds.length} desktop builds in recent releases`);
      return desktopBuilds;
    } catch (error) {
      console.error('Error fetching all desktop builds:', error);
      return [];
    }
  }

  /**
   * Get the current build version being used
   * @returns {string} Current build version
   */
  getCurrentBuildVersion() {
    return this.currentVersion;
  }

  /**
   * Check for updates with strategy consideration
   * @returns {Promise<{version: string, downloadUrl: string, publishedAt: string, strategy: Object} | null>}
   */
  async checkForUpdatesWithStrategy() {
    // Check if we can check for client updates (no full app update in progress)
    if (!updateCoordinator.canCheckClientUpdates()) {
      console.log('Skipping client bundle update check - full app update in progress');
      return null;
    }

    try {
      const release = await this.checkForLatestRelease();
      if (!release) {
        return null;
      }

      // Determine update strategy
      const strategy = updateCoordinator.determineUpdateStrategy(null, release.version);
      
      return {
        ...release,
        strategy
      };
    } catch (error) {
      console.error('Error checking for updates with strategy:', error);
      return null;
    }
  }

  /**
   * Make HTTP request to GitHub API
   * @param {string} url - URL to request
   * @returns {Promise<string>} Response body
   */
  async makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Sila-Desktop',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      https.get(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Download file from URL
   * @param {string} url - URL to download from
   * @param {string} filePath - Local file path to save to
   */
  async downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(filePath);
      let downloadedBytes = 0;
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(filePath).catch(() => {}); // Clean up partial file
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            console.log(`Download progress: ${progress}%`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`Download completed: ${downloadedBytes} bytes`);
          resolve();
        });
        
        file.on('error', (error) => {
          file.close();
          fs.unlink(filePath).catch(() => {}); // Clean up partial file
          reject(error);
        });
        
        response.on('error', (error) => {
          file.close();
          fs.unlink(filePath).catch(() => {}); // Clean up partial file
          reject(error);
        });
      }).on('error', (error) => {
        file.close();
        fs.unlink(filePath).catch(() => {}); // Clean up partial file
        reject(error);
      });
    });
  }

  /**
   * Extract zip file to directory
   * @param {string} zipPath - Path to zip file
   * @param {string} extractPath - Path to extract to
   */
  async extractZipFile(zipPath, extractPath) {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
  }
}

// Create singleton instance
const githubReleaseManager = new GitHubReleaseManager();

/**
 * Setup IPC handlers for GitHub release management
 */
export function setupGitHubReleaseIPC() {
  // Check for latest release
  ipcMain.handle('check-github-release', async (event) => {
    return await githubReleaseManager.checkForLatestRelease();
  });

  // Check for updates with strategy
  ipcMain.handle('check-updates-with-strategy', async (event) => {
    return await githubReleaseManager.checkForUpdatesWithStrategy();
  });

  // Download and extract a specific build
  ipcMain.handle('download-github-build', async (event, { downloadUrl, version }) => {
    return await githubReleaseManager.downloadAndExtractBuild(downloadUrl, version);
  });

  // Get available builds
  ipcMain.handle('get-available-builds', async (event) => {
    return await githubReleaseManager.getAvailableBuilds();
  });

  // Get all available desktop builds from recent releases
  ipcMain.handle('get-all-available-desktop-builds', async (event) => {
    return await githubReleaseManager.getAllAvailableDesktopBuilds();
  });

  // Get current build version
  ipcMain.handle('get-current-build-version', async (event) => {
    return githubReleaseManager.getCurrentBuildVersion();
  });

  // Reload to latest build
  ipcMain.handle('reload-to-latest-build', async (event) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      // Reload with the latest build
      mainWindow.loadURL('sila://builds/desktop/index.html');
      return true;
    }
    return false;
  });

  // Get update coordinator state
  ipcMain.handle('get-update-coordinator-state', async (event) => {
    return updateCoordinator.getState();
  });
}

export { githubReleaseManager };