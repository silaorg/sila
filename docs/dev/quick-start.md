# Quick start for devs

Use Node.js 22.20 or later. On Windows, install Git Bash and add it to `PATH`;
the repository runs npm scripts with Bash.

```sh
git clone --recurse-submodules git@github.com:silaorg/sila.git
cd sila
npm ci
npm run dev
```

For an existing checkout, run `git submodule update --init --recursive` before installation.
Build the desktop client with `npm -w packages/desktop run build`.
See [AI source dependencies](aiwrapper-linking.md) for updates and OpenRouter checks.

## Building for macOS

If you want to build and package for internal tests without signing a certificate, run `npm run -w packages/desktop package:mac:unsigned`.

## Linux: Electron sandbox fix

If the desktop dev build fails with a `chrome-sandbox` SUID error, run:

```bash
sudo chown root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

Then rerun `npm run dev`.

## Debug with breakpoints

If you want to debug with breakpoints in a VSCode-based editor (e.g Cursor), go to "Start Debugging F5" and start "👉 Debug Electron All".