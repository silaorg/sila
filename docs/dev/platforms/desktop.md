# Desktop Platform Build Guide

This document describes how to build and package Sila for desktop platforms (macOS, Windows, Linux) using Electron.

## Overview

The Sila desktop app is built using:
- **Svelte + Vite** for the web layer (simple setup, no SvelteKit)
- **Electron** for native desktop integration
- **Client and core packages** for the actual functionality of the app

## Prerequisites

### Required Tools
- **Node.js** (v18+)
- **Electron Builder** - Included in dependencies

### Platform-Specific Requirements

#### macOS
- macOS for building macOS apps
- Xcode command line tools

#### Windows
- Windows for building Windows apps

#### Linux
- Linux for building Linux apps

## Project Structure

```
packages/desktop/
├── src/
│   ├── main.ts              # Entry point
│   ├── DesktopApp.svelte    # Main app component
│   ├── electronFsWrapper.ts # Electron file system implementation
│   └── electronDialogsWrapper.ts # Electron dialogs implementation
├── src-electron/            # Electron main process files
├── static-desktop/          # Desktop-specific static assets
├── package.json
├── vite.config.js          # Vite build configuration
└── build/                  # Web build output
```

## Build Process

### 1. Web Build
The desktop app starts with a standard Vite build that creates web assets in the `build/` directory.

### 2. Electron Packaging
Electron Builder packages the web assets with the Electron runtime for each platform.

### 3. Platform-Specific Builds

#### macOS Build
- Creates `.dmg` installer for macOS
- Supports universal builds (Intel + Apple Silicon)

#### Windows Build
- Creates `.exe` installer using NSIS
- Supports x64 and ARM64 architectures

#### Linux Build
- Creates AppImage for universal Linux compatibility
- Supports x64 and ARM64 architectures

## Development Workflow

### Local Development
1. Start development server with `npm run dev`
2. Electron app launches automatically with hot reload
3. Web assets served from Vite dev server

### Native Integration
- **File System**: Electron APIs for file operations and watching
- **Dialogs**: Native platform dialogs for file operations
- **Auto-updater**: Built-in update mechanism for production apps
- **Menu System**: Native application menus and shortcuts

## Automated Builds

We use GitHub Actions for automated building and packaging across all platforms. The build system automatically:

- Builds the web assets using Vite
- Packages for macOS, Windows, and Linux using Electron Builder
- Creates installers and distributables
- Publishes releases with platform-specific assets

For details about the build system, see the workflow files in `.github/workflows/` in the repository.

### Debug Commands
- `npm run dev:without-starting-electron` - Web dev without Electron
- `npm run preview` - Preview built web assets