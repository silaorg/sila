# Heswe Desktop

A thin Electron shell that mounts `HesweApp` from `@heswe/client`, the same
package used by the web app. Workspaces, authentication, files, and agents stay
in the existing Heswe API. The renderer has no Node or filesystem access.

Run from the repository root:

```sh
npm run dev:desktop
```

The launcher starts the local API and desktop renderer on an available port
pair, then opens a native window. Interface edits update live. Restart the
command after changing Electron main code. Quitting the app stops its local
services. Storage defaults to the checkout's `.data/` directory.

To build the shared client and launch that build:

```sh
npm run build:desktop
npm run start:desktop
```

`start:desktop` still runs the local API in development mode so agents can use
local Node processes. These commands do not create a distributable installer.
