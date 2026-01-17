# Quick start for devs

1. Clone the repository `git clone git@github.com:silaorg/sila.git`
2. Run in your terminal at the root of the repository - `cd sila && npm install && npm run dev` to install all the necessary npm packages and launch a desktop build.
3. To build for production - `npm run build`

### Building for macOS

If you want to build and package for internal tests without signing a certificate, run `npm run -w packages/desktop package:mac:unsigned`.

### Linux: Electron sandbox fix

If the desktop dev build fails with a `chrome-sandbox` SUID error, run:

```bash
sudo chown root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

Then rerun `npm run dev`.

## Debug with breakpoints

If you want to debug with breakpoints in a VSCode-based editor (e.g Cursor), go to "Start Debugging F5" and start "👉 Debug Electron All".