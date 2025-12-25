import { app, BrowserWindow, ipcMain } from 'electron';

app.setName('Sila');

import { setupDialogsInMain } from './dialogs/electronDialogsMain.js';
import { setupElectronMenu } from './electronMenu.js';
import { createWindow } from './electronWindow.js';
import { setUpdater, checkForUpdates } from './updates/updater.js';
import { setupGitHubReleaseIPC } from './updates/githubReleaseManager.js';
import { setupSilaProtocol } from './silaProtocol.js';
import { getSelectedClientBuildInfo } from './silaProtocol.js';
import { spaceManager } from './spaceManager.js';

// Development mode check
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

function getViteAppVersion() {
  return process.env.VITE_APP_VERSION || 'dev';
}

/**
 * Setup IPC handlers for space management
 */
function setupSpaceManagementIPC() {
  ipcMain.handle('register-space', async (event, { spaceId, rootPath, name, createdAt }) => {
    spaceManager.registerSpace(spaceId, rootPath, name, createdAt);
    return true;
  });

  ipcMain.handle('unregister-space', async (event, spaceId) => {
    return spaceManager.unregisterSpace(spaceId);
  });

  ipcMain.handle('has-space', async (event, spaceId) => {
    return spaceManager.hasSpace(spaceId);
  });

  ipcMain.handle('get-all-spaces', async (event) => {
    return spaceManager.getAllSpaces();
  });
}

/**
 * Setup IPC handlers for app version info (shell + currently selected client build)
 */
function setupAppVersionIPC() {
  ipcMain.handle('sila:get-app-versions', async () => {
    const shellVersion = app.getVersion();
    if (isDev) {
      return {
        shell: { version: shellVersion },
        client: { version: getViteAppVersion(), source: 'dev server' }
      };
    }

    try {
      const selected = await getSelectedClientBuildInfo();
      return {
        shell: { version: shellVersion },
        client: { version: selected.version, source: selected.source, buildName: selected.buildName }
      };
    } catch (e) {
      // Fallback: assume embedded
      return {
        shell: { version: shellVersion },
        client: { version: shellVersion, source: 'embedded' }
      };
    }
  });
}

// Keep a global reference of the window object
/** @type {BrowserWindow | null} */
let mainWindow;

// Type declaration for global
/** @type {any} */
const globalAny = global;

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  
  // Setup custom protocol (sila://)
  setupSilaProtocol();

  // Setup IPC handlers for space management
  setupSpaceManagementIPC();

  // Setup IPC for app versions
  setupAppVersionIPC();

  // Setup IPC for desktop build management (GitHub releases)
  setupGitHubReleaseIPC();

  // Setup updater to update the app package and client bundle
  setUpdater(isDev);
  
  // Setup main window with menu and dialogs
  mainWindow = createWindow(isDev);
  setupElectronMenu(mainWindow);
  setupDialogsInMain();

  // IPC: window fullscreen state
  ipcMain.handle('sila:window:isFullScreen', async () => {
    return !!mainWindow?.isFullScreen();
  });

  function emitFullscreenState() {
    try {
      mainWindow?.webContents?.send('sila:window:fullscreen', {
        isFullScreen: !!mainWindow?.isFullScreen(),
      });
    } catch (e) {
      console.error('Failed to emit fullscreen state', e);
    }
  }

  mainWindow.on('enter-full-screen', emitFullscreenState);
  mainWindow.on('leave-full-screen', emitFullscreenState);

  // IPC: allow renderer to update the titlebar overlay colors (Windows/Linux)
  ipcMain.handle('sila:titlebar:setOverlay', async (_event, overlay) => {
    if (!mainWindow) return false;
    if (process.platform === 'darwin') return false;
    try {
      // Electron validates shape at runtime; keep it permissive here.
      mainWindow.setTitleBarOverlay(overlay);
      return true;
    } catch (e) {
      console.error('Failed to setTitleBarOverlay', e);
      return false;
    }
  });
  
  // IPC: cors-less fetch for renderer
  ipcMain.handle('sila:proxyFetch', async (event, url, init) => {
    const res = await fetch(url, init);
    const text = await res.text();
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Array.from(res.headers.entries()),
      body: text,
    };
  });

  // Expose manual update check for menu
  globalAny.checkForUpdates = checkForUpdates;

  app.on('activate', function () {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(isDev);
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    event.preventDefault?.();
    console.log('Blocked new window creation to:', url);
    return { action: 'deny' };
  });
}); 
