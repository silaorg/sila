import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { dialog, BrowserWindow } from 'electron';
import { updateCoordinator } from './updateCoordinator.js';

// Standard auto-updater setup - this is the usual way
export function setupAutoUpdater() {
  // Configure auto updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Set up event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (/** @type {any} */ info) => {
    console.log('Update available:', info);
    
    // Determine if we should use this full app update based on strategy
    const strategy = updateCoordinator.determineUpdateStrategy(info.version, null);
    
    if (strategy && strategy.useFullAppUpdate) {
      console.log('Using full app update based on strategy:', strategy.reason);
      updateCoordinator.setFullAppUpdate(true);
      // Auto-download is now enabled, so we just log and let it download automatically
    } else {
      console.log('Skipping full app update based on strategy:', strategy?.reason || 'No strategy');
      // Don't mark as updating, allow client bundle updates
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Update not available');
    // No full app update available, allow client bundle updates
    updateCoordinator.setFullAppUpdate(false);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto updater error:', err);
  });

  autoUpdater.on('update-downloaded', (/** @type {any} */ info) => {
    console.log('Update downloaded:', info);
    showInstallDialog(info);
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}


function showInstallDialog(/** @type {any} */ info) {
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
}

// Manual update check function
export function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    console.log('Skipping update check in development mode');
    return;
  }
  autoUpdater.checkForUpdates();
} 