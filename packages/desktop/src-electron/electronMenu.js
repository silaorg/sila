import { Menu } from 'electron';

export function setupElectronMenu() {
  // Only show a full application menu on macOS.
  // On Windows/Linux we rely on in-app UI and keep the menu hidden.
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    // On macOS, the first menu is automatically the app menu (shows as "Sila")
    ...(process.platform === 'darwin' ? [/** @type {import('electron').MenuItemConstructorOptions} */ ({
      role: 'appMenu'  // This automatically creates the standard macOS app menu with Quit
    })] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+N',
          click: function () {
            // Add file operations here
            console.log('Open new conversation');
          }
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
    /** @type {import('electron').MenuItemConstructorOptions} */ ({
      role: 'editMenu'  // Standard Edit menu with undo, redo, cut, copy, paste, etc.
    }),
    /** @type {import('electron').MenuItemConstructorOptions} */ ({
      role: 'viewMenu'  // Standard View menu with reload, devtools, zoom, etc.
    }),
    /** @type {import('electron').MenuItemConstructorOptions} */ ({
      role: 'windowMenu'  // Standard Window menu
    }),
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: function () {
            console.log('Manual update check requested');
            /** @type {any} */
            const globalAny = global;
            if (globalAny.checkForUpdates) {
              globalAny.checkForUpdates();
            }
          }
        },
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ type: 'separator' }),
        /** @type {import('electron').MenuItemConstructorOptions} */ ({ role: 'about' })
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}