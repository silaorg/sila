# Desktop Platform Build Guide

This document describes how to build and package Sila for desktop platforms (macOS, Windows, Linux) using Electron.

## Overview

The Sila desktop app is built using:
- **Svelte + Vite** for the web layer (simple setup, no SvelteKit)
- **Electron** for native desktop integration
- **Shared client/core packages** for consistent functionality across platforms

## Prerequisites

### Required Tools
- **Node.js** (v18+)
- **Electron Builder** - Included in dependencies
- **Platform-specific tools** for code signing and notarization

### Platform-Specific Requirements

#### macOS
- macOS for building macOS apps
- Xcode command line tools
- Apple Developer account (for notarization)
- Certificate for code signing

#### Windows
- Windows for building Windows apps
- Code signing certificate (optional but recommended)

#### Linux
- Linux for building Linux apps
- AppImage or other distribution format support

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
- Requires code signing and notarization for distribution

#### Windows Build
- Creates `.exe` installer using NSIS
- Supports x64 and ARM64 architectures
- Code signing recommended for distribution

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

## Distribution

### macOS Distribution
- **Mac App Store**: Archive and upload through App Store Connect
- **Direct Download**: DMG installer with notarization
- **Auto-updates**: Built-in updater with GitHub releases

### Windows Distribution
- **Microsoft Store**: Package and upload through Partner Center
- **Direct Download**: NSIS installer with code signing
- **Auto-updates**: Built-in updater with GitHub releases

### Linux Distribution
- **App Stores**: Upload AppImage to various Linux app stores
- **Direct Download**: AppImage for universal compatibility
- **Package Managers**: Potential future support for snap/flatpak

## Code Signing & Security

### macOS
- Apple Developer certificate for code signing
- Notarization through Apple for security verification
- Hardened runtime for enhanced security

### Windows
- Code signing certificate (DigiCert, Sectigo, etc.)
- Windows Defender SmartScreen compatibility
- Authenticode signing for installer trust

## Troubleshooting

### Common Issues
- **Build failures**: Check Electron and platform-specific dependencies
- **Signing errors**: Verify certificates and provisioning profiles
- **Notarization failures**: Check Apple Developer account status
- **Update issues**: Verify GitHub release configuration

### Debug Commands
- `npm run dev:without-starting-electron` - Web dev without Electron
- `npm run preview` - Preview built web assets

## Future Enhancements

### Planned Features
- Enhanced file system integration
- Native desktop notifications
- System tray integration
- Advanced auto-update mechanisms
- Platform-specific optimizations

### Platform-Specific Features
- macOS: Touch Bar support, native macOS integrations
- Windows: Windows-specific UI adaptations
- Linux: Desktop environment integrations

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder Documentation](https://www.electron.build/)
- [macOS Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/msix/package/packaging-uwp-apps)