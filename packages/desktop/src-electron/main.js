import { app, BrowserWindow, dialog, Menu, shell } from "electron";

app.setName("Heswe");
const desktopUrl = process.env.HESWE_DESKTOP_URL;
if (!desktopUrl) throw new Error("Launch the desktop app with npm run dev:desktop or npm run start:desktop.");
const desktopOrigin = new URL(desktopUrl).origin;

function openExternal(url) {
  try {
    if (["https:", "http:", "mailto:"].includes(new URL(url).protocol)) {
      void shell.openExternal(url);
    }
  } catch {
    // Ignore malformed links.
  }
}

function createWindow() {
  const window = new BrowserWindow({
    title: "Heswe",
    width: 1280,
    height: 850,
    minWidth: 760,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  const checkNavigation = (event, url) => {
    try {
      if (new URL(url).origin === desktopOrigin) return;
    } catch {
      // Malformed navigation targets are blocked too.
    }
    event.preventDefault();
    openExternal(url);
  };
  window.webContents.on("will-navigate", checkNavigation);
  window.webContents.on("will-redirect", checkNavigation);
  window.once("ready-to-show", () => {
    window.show();
    window.focus();
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  void window.loadURL(desktopUrl).catch((error) => {
    dialog.showErrorBox("Unable to open Heswe", error.message);
    app.quit();
  });
}

process.on("message", (message) => {
  if (message === "heswe-desktop:stop") app.quit();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu", label: "Heswe" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
  createWindow();
});

app.on("window-all-closed", () => app.quit());
