# GitHub Release Manager

This document describes the GitHub Release Manager functionality that allows downloading and swapping desktop builds from GitHub releases.

## Overview

The GitHub Release Manager enables the Sila desktop app to:
1. Check for latest releases on GitHub
2. Download `desktop-v{version}.zip` files from releases
3. Extract and manage multiple build versions
4. Switch between different build versions seamlessly

## Architecture

### Backend (Electron Main Process)
- **File**: `src-electron/githubReleaseManager.js`
- **Class**: `GitHubReleaseManager`
- **Storage**: `{userData}/builds/` directory
- **Protocol**: Uses `sila://builds/` protocol for serving files

### Frontend (Renderer Process)
- **File**: `src/lib/comps/dev/DevPanel.svelte`
- **API**: Exposed via `window.electronFileSystem`
- **UI**: Development panel with download controls

## Usage

### For Developers

1. **Enable Dev Mode**: The GitHub Release Manager is available in the development panel
2. **Check for Updates**: Click "Check for Updates" to fetch latest release info
3. **Download Build**: Click "Download & Install Latest" to get the newest build
4. **Automatic Reload**: The app will automatically reload to the new build

### For Users

The functionality is currently only available in development mode. To make it available to end users, you would need to:

1. Add a settings/preferences UI
2. Implement automatic update checking
3. Add user notifications for available updates

## API Reference

### IPC Handlers

- `check-github-release`: Check for latest GitHub release
- `download-github-build`: Download and extract a specific build
- `get-available-builds`: Get list of available builds
- `get-current-build-version`: Get current build version
- `reload-to-latest-build`: Reload to latest build

### Frontend API

```javascript
// Check for latest release
const release = await window.electronFileSystem.checkGitHubRelease();

// Download a build
const success = await window.electronFileSystem.downloadGitHubBuild(
  release.downloadUrl, 
  release.version
);

// Get available builds
const builds = await window.electronFileSystem.getAvailableBuilds();

// Reload to latest build
await window.electronFileSystem.reloadToLatestBuild();
```

## File Structure

```
{userData}/builds/
├── desktop-v1.0.1/
│   ├── index.html
│   ├── assets/
│   └── ...
├── desktop-v1.0.2/
│   ├── index.html
│   ├── assets/
│   └── ...
└── ...
```

## Protocol URLs

- `sila://builds/desktop/index.html` - Latest desktop build
- `sila://builds/desktop-v1.0.1/index.html` - Specific version
- `sila://builds/` - List available builds

## Configuration

The GitHub repository is configured in `githubReleaseManager.js`:

```javascript
this.owner = 'silaorg'; // GitHub organization/username
this.repo = 'sila';      // Repository name
```

## Testing

Run the test script to verify GitHub API connectivity:

```bash
cd packages/desktop
node test-github-release.js
```

## Dependencies

- `adm-zip`: For extracting zip files
- `https`: For downloading files
- `fs/promises`: For file system operations

## Security Considerations

- Downloads are verified to contain `index.html`
- File size validation prevents empty downloads
- Path traversal protection in protocol handler
- Cleanup of temporary files on errors

## Creating Desktop Build Assets

To use this feature, you need to create `desktop-v{version}.zip` files in your GitHub releases. This can be done by:

1. **Manual Creation**: Build the desktop app and create a zip file with the build output
2. **CI/CD Integration**: Add a step to your release workflow to create the desktop build zip
3. **Build Script**: Create a script that packages the build output into a zip file

Example build script:
```bash
#!/bin/bash
# Create desktop build zip for GitHub release
VERSION=$1
BUILD_DIR="build"
ZIP_NAME="desktop-v${VERSION}.zip"

# Ensure build directory exists
if [ ! -d "$BUILD_DIR" ]; then
  echo "Build directory not found. Run 'npm run build' first."
  exit 1
fi

# Create zip file
cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" .
cd ..

echo "Created $ZIP_NAME"
```

## Future Enhancements

1. **Automatic Updates**: Background checking and downloading
2. **Rollback Support**: Easy reversion to previous versions
3. **Delta Updates**: Only download changed files
4. **User Preferences**: Settings for update behavior
5. **Progress Indicators**: Better download progress feedback
6. **Signature Verification**: Cryptographic verification of downloads
7. **Build Asset Creation**: Automated creation of desktop-v{version}.zip files in CI/CD