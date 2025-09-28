# Fallback Desktop Builds

This document describes the fallback mechanism for finding desktop builds when the latest release doesn't contain one.

## Overview

The GitHub Release Manager now includes a robust fallback system that searches through recent releases to find desktop builds, even when the latest release doesn't contain a `desktop-v{version}.zip` asset.

## How It Works

### 1. Primary Check (Latest Release)
- First checks the latest GitHub release for a `desktop-v{version}.zip` asset
- If found, uses that build for updates

### 2. Fallback Search (Recent Releases)
- If no desktop build is found in the latest release, searches through the last 20 releases
- Looks for any release containing a `desktop-v{version}.zip` asset
- Returns the most recent desktop build found

### 3. All Available Builds
- Provides a comprehensive list of all desktop builds available across recent releases
- Useful for manual selection or debugging

## API Methods

### `findDesktopBuildInRecentReleases()`
- Searches through recent releases (last 10) for desktop builds
- Returns the first desktop build found
- Used as fallback when latest release has no desktop build

### `getAllAvailableDesktopBuilds()`
- Fetches all desktop builds from recent releases (last 20)
- Returns comprehensive list with metadata
- Useful for manual selection and debugging

## Usage Examples

### Check for Updates with Fallback
```javascript
// This will automatically use fallback if latest release has no desktop build
const releaseInfo = await githubReleaseManager.checkForLatestRelease();
```

### Get All Available Builds
```javascript
// Get all desktop builds from recent releases
const allBuilds = await githubReleaseManager.getAllAvailableDesktopBuilds();
console.log(`Found ${allBuilds.length} desktop builds`);
```

### Download Specific Build
```javascript
// Download a specific build from the list
const build = allBuilds[0]; // Get the newest build
await githubReleaseManager.downloadAndExtractBuild(build.downloadUrl, build.version);
```

## Frontend Integration

The DevPanel now shows:
- **All Available Desktop Builds**: Complete list with download buttons
- **Fallback Information**: Shows when a build comes from a recent release (not latest)
- **Manual Selection**: Users can choose any available build to download

## Benefits

1. **Robustness**: Never fails to find a desktop build if one exists in recent releases
2. **Flexibility**: Users can choose from multiple available builds
3. **Transparency**: Clear indication of where builds come from
4. **Debugging**: Easy to see all available options

## Configuration

- **Recent Releases Limit**: 20 releases (configurable via `per_page` parameter)
- **Search Depth**: Last 10 releases for fallback (configurable)
- **Sorting**: Builds sorted by version (newest first)

## Error Handling

- Graceful fallback when latest release has no desktop build
- Comprehensive error logging for debugging
- Empty arrays returned on failure (no crashes)

## Testing

Use the test script to verify functionality:
```bash
cd packages/desktop
node test-all-desktop-builds.js
```

This will show all available desktop builds from recent releases and verify the fallback mechanism works correctly.