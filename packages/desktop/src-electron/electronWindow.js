import { app, BrowserWindow, Menu, shell } from 'electron';
import serve from 'electron-serve';
import path from 'path';
import { fileURLToPath } from 'url';

import { getWindowOptionsWithState, saveWindowState, loadWindowState } from './windowState.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serveURL = serve({ directory: '.' });

/**
 * Creates a new browser window
 * @param {boolean} isDev
 * @returns {BrowserWindow}
 */
export function createWindow(isDev) {
  // Create the browser window with saved state
  const windowOptions = getWindowOptionsWithState({
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: !isDev, // Needed for SvelteKit in development
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  const mainWindow = new BrowserWindow(windowOptions);

  // Explicitly hide menubar on Windows/Linux in case a desktop env forces it
  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  // Load the appropriate URL/file based on environment
  if (isDev) {
    // Development: load from SvelteKit dev server
    mainWindow.loadURL('http://localhost:6969');
  } else {
    // Production: load via custom protocol from the embedded client bundle
    // Fallback to electron-serve if embedded build is not found (e.g., not built yet)
    (async () => {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirnameLocal = path.dirname(__filename);
        const fs = await import('fs/promises');

        // Determine latest available desktop build
        const appVersion = app.getVersion();
        const embeddedName = `desktop-v${appVersion}`;
        const buildsRoot = path.join(app.getPath('userData'), 'builds');

        // List builds in userData/builds
        let userBuildNames = [];
        try {
          const dirents = await fs.readdir(buildsRoot, { withFileTypes: true });
          userBuildNames = dirents.filter(d => d.isDirectory()).map(d => d.name);
        } catch {}

        // Collect desktop-v* names including embedded
        const allNames = Array.from(new Set([embeddedName, ...userBuildNames]));
        const desktopNames = allNames.filter(n => n.startsWith('desktop-v'));

        function parseSemver(name) {
          const m = name.match(/^desktop-v(\d+)\.(\d+)\.(\d+)$/);
          if (!m) return null;
          return { major: +m[1], minor: +m[2], patch: +m[3] };
        }

        function cmp(a, b) {
          const va = parseSemver(a);
          const vb = parseSemver(b);
          if (!va && !vb) return 0;
          if (!va) return -1;
          if (!vb) return 1;
          if (va.major !== vb.major) return va.major - vb.major;
          if (va.minor !== vb.minor) return va.minor - vb.minor;
          return va.patch - vb.patch;
        }

        // Pick highest semver
        const latestName = desktopNames.sort(cmp).pop();

        if (latestName) {
          // Try loading via protocol
          mainWindow.loadURL(`sila://builds/${latestName}/index.html`);
        } else {
          // Fall back to serving from packaged build directory using electron-serve
          serveURL(mainWindow);
        }
      } catch (e) {
        // As a last resort, try electron-serve
        serveURL(mainWindow);
      }
    })();
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      
      // Restore maximized state if it was saved
      const state = loadWindowState();
      if (state.isMaximized) {
        mainWindow.maximize();
      }
      
      // Restore DevTools state if it was saved
      if (state.isDevToolsOpen && isDev) {
        mainWindow.webContents.openDevTools();
      }
    } else {
      console.error("mainWindow is not set");
    }
  });

  // DevTools auto-opens only if user didn't previously close it
  if (isDev) {
    const state = loadWindowState();
    if (!state.isDevToolsOpen) {
      // Only auto-open DevTools if it wasn't previously closed by user
      // mainWindow.webContents.openDevTools();
    }
  }

  // Note: Can't save state on 'closed' event - window is already destroyed
  mainWindow.on('closed', function () {
    // State is saved on other events instead
  });
  
  // Save window state when window is resized or moved
  mainWindow.on('resize', () => {
    saveWindowState(mainWindow);
  });
  
  mainWindow.on('move', () => {
    saveWindowState(mainWindow);
  });
  
  // Save state when window is maximized/unmaximized
  mainWindow.on('maximize', () => {
    saveWindowState(mainWindow);
  });
  
  mainWindow.on('unmaximize', () => {
    saveWindowState(mainWindow);
  });
  
  // Save state when DevTools is opened or closed
  mainWindow.webContents.on('devtools-opened', () => {
    saveWindowState(mainWindow);
  });
  
  mainWindow.webContents.on('devtools-closed', () => {
    saveWindowState(mainWindow);
  });
  
  // Save state when app is about to quit
  app.on('before-quit', () => {
    saveWindowState(mainWindow);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return mainWindow;
}