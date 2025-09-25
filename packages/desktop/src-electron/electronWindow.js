import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

import { getWindowOptionsWithState, saveWindowState, loadWindowState } from './windowState.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      webSecurity: !isDev,
      partition: 'persist:sila',
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
    // Production: request the latest desktop build via protocol resolver
    // Prefer explicit embedded version to avoid any resolver issues on first run
    const embeddedName = `desktop-v${app.getVersion()}`;
    const urlToLoad = `sila://builds/${embeddedName}/index.html`;
    console.log('Loading URL:', urlToLoad);
    mainWindow.loadURL(encodeURI(urlToLoad));

    // If load fails for any reason, keep window visible to inspect errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', { errorCode, errorDescription, validatedURL });
      try { mainWindow.show(); } catch {}
    });
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