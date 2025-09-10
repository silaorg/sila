# Sila Desktop - Electron + Svelte

A desktop application of Sila is built with Electron. We have a thin Svelte app here that imports and sets up the "client". All of the functionality of Sila is in the client and core.

## Local .env (example)
Create `packages/desktop/.env` by copying the example below. Used for macOS signing/notarization and optional GitHub publishing from local machine.

```
# Apple Developer credentials
APPLE_ID=your-apple-id@example.com
APPLE_TEAM_ID=YOUR_TEAM_ID
# App-specific password generated at appleid.apple.com (cannot be viewed later)
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
# Optional if you belong to multiple teams (short provider name)
# ASC_PROVIDER=YOUR_PROVIDER_SHORT_NAME

# Optional: GitHub token if you plan to publish from local machine
# GH_TOKEN=ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Optional: If you use a certificate file instead of Keychain auto-discovery
# CSC_LINK=base64-or-file-url-to-p12
# CSC_KEY_PASSWORD=your-p12-password
```