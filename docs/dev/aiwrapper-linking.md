# Linking Local AIWrapper Package

## Purpose

When new features or fixes are added to the `aiwrapper` repository, you may want to test them in `sila` before publishing `aiwrapper` to npm. This workflow allows you to quickly link your local `aiwrapper` development version for testing.

## How It Works

We use npm's `link` mechanism, which creates symlinks in `node_modules` instead of modifying `package.json`. This ensures:

- **No accidental commits**: `package.json` remains unchanged, so you won't accidentally commit a local file path
- **Quick switching**: Toggle between local and published versions with a single command
- **Safe**: The version in `package.json` reflects what will be installed for others and in CI

## Requirements

The `aiwrapper` repository must be located at the same directory level as `sila`. The scripts expect `aiwrapper` at `../aiwrapper` relative to the `sila` repository root.

For example:
```
repos/
  ├── sila/
  └── aiwrapper/
```

### Platform Support

The linking scripts are bash scripts that work on:
- **Linux** - Full support
- **macOS** - Full support
- **Windows** - Requires Git Bash, WSL, or similar Unix-like environment

On Windows, you can also use the npm commands directly:
```bash
# In Git Bash or WSL
cd ../aiwrapper && npm link
cd ../sila && npm link aiwrapper
```

## Usage

```bash
# Check current status (linked or published)
npm run aiwrapper:status

# Link to local aiwrapper package
npm run aiwrapper:link

# Test new features in sila...

# Switch back to published version
npm run aiwrapper:unlink
```

## What Happens

**When linking:**
1. The local `aiwrapper` package is registered globally via `npm link`
2. A symlink is created in `node_modules/aiwrapper` pointing to your local package
3. The `"aiwrapper": "^3.0.0-beta.5"` entry in `packages/core/package.json` is ignored while the link is active
4. New features in your local `aiwrapper` package are immediately available for testing (rebuild aiwrapper if it has a build step)

**When unlinking:**
1. The symlink is removed
2. The published version from npm is reinstalled according to `package.json`
3. Normal npm dependency resolution resumes

## Implementation

The scripts are located in `scripts/`:
- `scripts/link-aiwrapper-local.sh` - Creates the link
- `scripts/unlink-aiwrapper-local.sh` - Removes the link and reinstalls from npm
- `scripts/check-aiwrapper-link.sh` - Checks if currently linked to local version