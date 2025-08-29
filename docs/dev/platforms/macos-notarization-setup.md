# macOS Notarization Setup Guide

This guide explains how to set up macOS notarization for the Sila desktop app, both for local development and CI/CD builds.

## What is Notarization?

Notarization is Apple's process for verifying that your app is safe to run on macOS. When users try to run a notarized app for the first time, macOS will show a message saying the app has been checked for malicious software.

## Prerequisites

1. **Apple Developer Account**: You need a paid Apple Developer account
2. **App-Specific Password**: Generate an app-specific password for notarization
3. **Code Signing Certificate**: A Developer ID Application certificate

## Required Environment Variables

For notarization to work, you need to set these environment variables:

```bash
# Apple Developer account email
export APPLE_ID="your-apple-id@example.com"

# App-specific password (not your regular Apple ID password)
export APPLE_ID_PASSWORD="your-app-specific-password"

# Optional but recommended if you are in multiple teams
export APPLE_TEAM_ID="UY76UFAS3C"

# Code signing certificate (for CI/CD)
export CSC_LINK="path-to-certificate.p12"

# Certificate password
export CSC_KEY_PASSWORD="certificate-password"
```

## Setting Up App-Specific Password

1. Go to [Apple ID website](https://appleid.apple.com)
2. Sign in with your Apple Developer account
3. Go to "Security" → "App-Specific Passwords"
4. Click "Generate Password"
5. Give it a name like "Sila Notarization"
6. Copy the generated password (it won't be shown again)

## Local Development Setup

### Option 1: Environment Variables (Recommended)

Create a `.env` file in the `packages/desktop` directory:

```bash
# packages/desktop/.env
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=your-app-specific-password
# Optional if you belong to multiple teams
# APPLE_TEAM_ID=UY76UFAS3C
```

Then modify the build script to load these variables:

```bash
# In packages/desktop/package.json, update the build script:
"build:electron": "source .env 2>/dev/null || true && electron-builder"
```

### Option 2: Direct Export

Export the variables before building:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
# Optional
# export APPLE_TEAM_ID="UY76UFAS3C"
npm run build
```

### Option 3: Disable Notarization for Development

If you don't need notarization during development, you can temporarily disable it:

```json
// In packages/desktop/package.json
{
  "build": {
    "mac": {
      "notarize": false
    }
  }
}
```

## CI/CD Setup (GitHub Actions)

The project already has GitHub Actions configured for notarization. The workflow uses these secrets:

- `APPLE_ID`: Your Apple Developer account email
- `APPLE_ID_PASSWORD`: Your app-specific password
- `MACOS_CERTIFICATE_P12`: Base64-encoded code signing certificate
- `MACOS_CERTIFICATE_PASSWORD`: Certificate password

## Testing Notarization

### 1. Build with Notarization

```bash
cd packages/desktop
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASS="your-app-specific-password"
npm run build
```

### 2. Check Notarization Status

After building, you can check if notarization was successful:

```bash
# Check the notarization status (legacy altool)
xcrun altool --notarization-info <UUID> -u "$APPLE_ID" -p "$APPLE_ID_PASSWORD"

# Or using notarytool if configured
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_ID_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

### 3. Verify the App

```bash
# Check if the app is properly signed and notarized
codesign --verify --verbose --deep --strict dist/mac/Sila.app
spctl --assess --verbose --type exec dist/mac/Sila.app
```

## Troubleshooting

### Common Issues

1. **"notarize options were unable to be generated"**
   - Missing `APPLE_ID` or `APPLE_ID_PASS` environment variables
   - Solution: Set the required environment variables

2. **"Invalid credentials"**
   - Wrong Apple ID or password
   - Using regular password instead of app-specific password
   - Solution: Generate a new app-specific password

3. **"No identity found"**
   - Missing code signing certificate
   - Solution: Install the Developer ID Application certificate

4. **"The operation couldn't be completed"**
   - Network issues or Apple's servers are down
   - Solution: Try again later

### Debug Notarization

Enable verbose logging:

```bash
export DEBUG=electron-builder
npm run build
```

### Check Notarization History

```bash
# List recent notarization requests
xcrun altool --list-notarization-history -u <APPLE_ID> -p <APPLE_ID_PASS>
```

## Security Best Practices

1. **Never commit credentials**: Use environment variables or secrets
2. **Use app-specific passwords**: Don't use your main Apple ID password
3. **Rotate credentials regularly**: Update app-specific passwords periodically
4. **Limit access**: Only give necessary team members access to notarization credentials

## Alternative: Skip Notarization for Development

If you're only developing locally and don't need notarization:

```json
// In packages/desktop/package.json
{
  "build": {
    "mac": {
      "notarize": false,
      "hardenedRuntime": false,
      "gatekeeperAssess": false
    }
  }
}
```

## Resources

- [Apple's Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder Notarization Guide](https://www.electron.build/configuration/code-signing#how-to-sign-app-using-p12-certificate)
- [App-Specific Passwords](https://support.apple.com/en-us/HT204397)
