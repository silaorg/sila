import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

import { getWindowOptionsWithState, saveWindowState, loadWindowState } from './windowState.js';
import { setupElectronContextMenu } from "./electronContextMenu.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a new browser window
 * @param {boolean} isDev
 * @returns {BrowserWindow}
 */
export function createWindow(isDev) {
  // Match platform conventions: macOS titlebars are shorter than Win/Linux.
  const TITLEBAR_HEIGHT = process.platform === 'darwin' ? 32 : 36;
  const TRAFFIC_LIGHT_SIZE = 14; // approximate native button cluster height
  const TRAFFIC_LIGHT_Y = Math.max(0, Math.round((TITLEBAR_HEIGHT - TRAFFIC_LIGHT_SIZE) / 2));
  // Create the browser window with saved state
  const windowOptions = getWindowOptionsWithState({
    autoHideMenuBar: process.platform !== 'darwin',
    // Custom titlebar (renderer-drawn) while keeping native window controls available.
    // See: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? {
          // Align traffic lights vertically within our renderer-drawn title bar.
          // See: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
          trafficLightPosition: { x: 12, y: TRAFFIC_LIGHT_Y },
        }
      : {}),
    ...(process.platform !== 'darwin'
      ? {
          // Expose native window controls on Windows/Linux.
          // Colors are updated dynamically from the renderer via IPC.
          titleBarOverlay: { height: TITLEBAR_HEIGHT },
        }
      : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: !isDev,
      spellcheck: true,
      /*partition: 'persist:sila',*/ // NOTE: If we use partition, make sure our sila:// protocol is using that partition
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  const mainWindow = new BrowserWindow(windowOptions);

  // Enable native context menus for editable fields (spellcheck suggestions, etc.)
  setupElectronContextMenu(mainWindow);

  // Explicitly hide menubar on Windows/Linux in case a desktop env forces it
  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  // Load the appropriate URL/file based on environment
  if (isDev) {
    // Development: load from SvelteKit dev server. The server has to be running
    mainWindow.loadURL('http://localhost:6969');
  } else {
    mainWindow.loadURL('sila://client/index.html');
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