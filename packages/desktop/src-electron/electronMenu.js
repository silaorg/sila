import { Menu, app } from 'electron';

/**
 * @param {import('electron').BrowserWindow | null} mainWindow
 */
export function setupElectronMenu(mainWindow) {
  // Only show a full application menu on macOS.
  // On Windows/Linux we rely on in-app UI and keep the menu hidden.
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }

  const sendAction = (actionId) => {
    try {
      mainWindow?.webContents.send('sila:menu-action', actionId);
    } catch (err) {
      console.error('Failed to send menu action', actionId, err);
    }
  };

  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    // On macOS, the first menu is automatically the app menu (shows as "Sila")
    ...(process.platform === 'darwin'
      ? [
          /** @type {import('electron').MenuItemConstructorOptions} */ ({
            label: app.name,
            submenu: [
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'about' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
              {
                label: 'Check for Updates',
                click: () => {
                  const globalAny = /** @type {any} */ (globalThis);
                  globalAny.checkForUpdates?.();
                }
              },
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'services' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'hide' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'hideOthers' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'unhide' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
              /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'quit' })
            ]
          })
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendAction('new-conversation')
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendAction('close-tab')
        },
        ({ type: 'separator' }),
        {
          label: 'Open Space',
          accelerator: 'CmdOrCtrl+O',
          click: function () {
            // Add file operations here
            console.log('Open space dialog');
          }
        },
        // Only add Quit to File menu on non-macOS (on macOS it's in the app menu)
        ...(process.platform !== 'darwin' ? [
          /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
          /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'quit' })
        ] : [])
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendAction('toggle-sidebar')
        },
        {
          label: 'Search Workspace',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => sendAction('workspace-search')
        },
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendAction('new-conversation')
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendAction('close-tab')
        },
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'reload' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'toggleDevTools' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'resetZoom' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'zoomIn' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'zoomOut' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'togglefullscreen' })
      ]
    },
    /** @type {import('electron').MenuItemConstructorOptions} */ ({
      role: 'editMenu'  // Standard Edit menu with undo, redo, cut, copy, paste, etc.
    }),
    /** @type {import('electron').MenuItemConstructorOptions} */ ({
      role: 'windowMenu'  // Standard Window menu
    }),
    {
      label: 'Help',
      submenu: []
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
