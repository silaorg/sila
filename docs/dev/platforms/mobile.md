# Mobile Platform Build Guide

This document describes how to build and package Sila for mobile platforms (iOS and Android) using Capacitor.

## Overview

The Sila mobile app is built using:
- **Svelte + Vite** for the web layer (simple setup, no SvelteKit)
- **Capacitor** for native mobile integration
- **Shared client/core packages** for consistent functionality across platforms

## Prerequisites

### Required Tools
- **Node.js** (v18+)
- **Xcode** (for iOS builds) - macOS only
- **Android Studio** (for Android builds)
- **Capacitor CLI**: `npm install -g @capacitor/cli`

### Platform-Specific Requirements

#### iOS
- macOS with Xcode 14+
- iOS 13+ deployment target
- Apple Developer account (for device testing and App Store)

#### Android
- Android Studio with SDK 33+
- Java 17+
- Android 7.0+ (API level 24+) deployment target

## Project Structure

```
packages/mobile/
├── src/
│   ├── main.ts              # Entry point
│   ├── MobileApp.svelte     # Main app component
│   └── [future native wrappers]
├── ios/                     # iOS native project (auto-generated)
├── android/                 # Android native project (auto-generated)
├── capacitor.config.ts      # Capacitor configuration
├── package.json
├── vite.config.js          # Vite build configuration
└── build/                  # Web build output
```

## Build Process

### 1. Web Build
The mobile app starts with a standard Vite build that creates web assets in the `build/` directory.

### 2. Capacitor Sync
Capacitor copies web assets to native projects and updates native dependencies using `npx cap sync`.

### 3. Platform-Specific Builds

#### iOS Build
- Open iOS project in Xcode with `npx cap open ios`
- Bundle ID: `com.silain.mobile`
- Deployment Target: iOS 13.0+

#### Android Build
- Open Android project in Android Studio with `npx cap open android`
- Package name: `com.silain.mobile`
- Target SDK: 33+, Minimum SDK: 24

## Development Workflow

### Local Development
1. Start development server with `npm run dev`
2. Run on device with `npx cap run ios` or `npx cap run android`
3. Use live reload for faster development

### Native Plugin Integration
- Current plugins: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`
- Future plugins: Filesystem, Dialogs, Device info, Share, Camera

## Distribution

### iOS Distribution
- **App Store**: Archive in Xcode, upload to App Store Connect
- **TestFlight**: Beta distribution through App Store Connect
- **Ad Hoc**: Internal distribution with provisioning profiles

### Android Distribution
- **Google Play**: Build AAB (recommended) or APK
- **Direct APK**: Generate signed APK for internal distribution

## Troubleshooting

### Common Issues
- **Build failures**: Check Vite configuration and dependencies
- **Capacitor sync fails**: Ensure `build/` directory exists
- **Native build fails**: Check platform-specific requirements
- **Signing errors**: Configure certificates and provisioning profiles

### Debug Commands
- `npx cap doctor` - Check Capacitor installation
- `npx cap ls` - List installed plugins

## Future Enhancements

### Planned Features
- Native file system integration
- Camera and photo import
- Native sharing capabilities
- Offline-first architecture
- Push notifications
- Background sync

### Platform-Specific Features
- iOS: Shortcuts integration, widgets
- Android: App shortcuts, adaptive icons
- Cross-platform: Cloud sync, collaboration

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Development Guide](https://developer.apple.com/ios/)
- [Android Development Guide](https://developer.android.com/)
- [Sila Mobile Proposal](../proposals/mobile-v1.md)