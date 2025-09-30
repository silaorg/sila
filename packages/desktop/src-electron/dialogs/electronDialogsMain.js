import { BrowserWindow, dialog, ipcMain } from 'electron';
import { ipcOpen, ipcSave, ipcShowInfo, ipcShowWarning, ipcShowError, ipcShowQuestion, ipcShowErrorBox } from './electronDialogIpc.js';

/**
 * Setup dialogs in the main process where we handle the dialogs
 * via the ipcMain
 */
export function setupDialogsInMain() {
  // IPC handlers for dialogs
  ipcMain.handle(ipcOpen, async (event, options) => {
    const browserWin = BrowserWindow.fromWebContents(event.sender);
    const properties = [options?.directory ? 'openDirectory' : 'openFile'];
    if (options?.multiple) properties.push('multiSelections');
    properties.push('createDirectory');

    /** @type {import('electron').OpenDialogOptions} */
    const params = {
      title: options?.title,
      defaultPath: options?.defaultPath,
      // @ts-ignore: runtime valid values
      properties,
      filters: options?.filters
    };

    // @ts-ignore - bypass TS type mismatch for properties array
    const result = browserWin
      ? await dialog.showOpenDialog(browserWin, /** @type any */(params))
      : await dialog.showOpenDialog(/** @type any */(params));
    if (result.canceled) return null;
    return options?.multiple ? result.filePaths : result.filePaths[0];
  });

  ipcMain.handle(ipcSave, async (event, options) => {
    const browserWin = BrowserWindow.fromWebContents(event.sender);
    /** @type {import('electron').SaveDialogOptions} */
    const params = {
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters
    };

    // @ts-ignore
    const result = browserWin
      ? await dialog.showSaveDialog(browserWin, /** @type any */(params))
      : await dialog.showSaveDialog(/** @type any */(params));
    if (result.canceled) return null;
    return result.filePath;
  });

  // Message dialog handlers
  ipcMain.handle(ipcShowInfo, async (event, options) => {
    return showMessageDialog(event, options, 'info');
  });

  ipcMain.handle(ipcShowWarning, async (event, options) => {
    return showMessageDialog(event, options, 'warning');
  });

  ipcMain.handle(ipcShowError, async (event, options) => {
    return showMessageDialog(event, options, 'error');
  });

  ipcMain.handle(ipcShowQuestion, async (event, options) => {
    return showMessageDialog(event, options, 'question');
  });

  ipcMain.handle(ipcShowErrorBox, async (event, title, content) => {
    dialog.showErrorBox(title, content);
  });
}

/**
 * Helper function to show message dialogs
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {import('@sila/client/appDialogs').MessageDialogOptions} options
 * @param {'info' | 'warning' | 'error' | 'question'} type
 */
async function showMessageDialog(event, options, type) {
  const browserWin = BrowserWindow.fromWebContents(event.sender);
  
  /** @type {import('electron').MessageBoxOptions} */
  const params = {
    type,
    title: options?.title,
    message: options.message,
    detail: options?.detail,
    buttons: options?.buttons || ['OK'],
    defaultId: options?.defaultId || 0,
    cancelId: options?.cancelId,
    checkboxLabel: options?.checkboxLabel,
    checkboxChecked: options?.checkboxChecked || false
  };

  const result = browserWin
    ? await dialog.showMessageBox(browserWin, params)
    : await dialog.showMessageBox(params);
  
  return {
    response: result.response,
    checkboxChecked: result.checkboxChecked
  };
}