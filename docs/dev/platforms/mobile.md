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
- **npm** or **yarn**
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

The mobile app starts with a standard Vite build that creates web assets:

```bash
cd packages/mobile

# Install dependencies
npm install

# Build web assets
npm run build
```

This creates a `build/` directory with:
- `index.html` - Main entry point
- `assets/` - Bundled JavaScript, CSS, and other assets
- Source maps for debugging

### 2. Capacitor Sync

Capacitor copies web assets to native projects and updates native dependencies:

```bash
# Sync web assets to native projects
npx cap sync
```

This command:
- Copies `build/` contents to `ios/App/App/public/` and `android/app/src/main/assets/public/`
- Updates native dependencies and plugins
- Regenerates native project files if needed

### 3. Platform-Specific Builds

#### iOS Build

```bash
# Open iOS project in Xcode
npx cap open ios

# Or build from command line (requires Xcode)
npx cap build ios
```

**Xcode Build Process:**
1. Open `ios/App/App.xcworkspace` in Xcode
2. Select target device or simulator
3. Build and run (⌘+R)

**iOS Configuration:**
- Bundle ID: `com.silain.mobile`
- Deployment Target: iOS 13.0+
- Signing: Configure in Xcode project settings

#### Android Build

```bash
# Open Android project in Android Studio
npx cap open android

# Or build from command line
npx cap build android
```

**Android Build Process:**
1. Open `android/` directory in Android Studio
2. Sync project with Gradle files
3. Build APK or run on device/emulator

**Android Configuration:**
- Package name: `com.silain.mobile`
- Target SDK: 33+
- Minimum SDK: 24 (Android 7.0)

## Configuration

### Capacitor Configuration

The `capacitor.config.ts` file controls Capacitor behavior:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.silain.mobile',
  appName: 'Sila',
  webDir: 'build',  // Web assets directory
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

### Build Configuration

**Vite Configuration** (`vite.config.js`):
```javascript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  base: './',  // Important for Capacitor
  build: {
    outDir: 'build',
    target: 'chrome120',  // Mobile browser compatibility
    sourcemap: true
  }
});
```

## Development Workflow

### Local Development

```bash
# Start development server
npm run dev

# In another terminal, run on device
npx cap run ios     # iOS simulator/device
npx cap run android # Android emulator/device
```

### Live Reload

For faster development, use live reload:

```bash
# Start web dev server
npm run dev

# Run with live reload
npx cap run ios --livereload --external
npx cap run android --livereload --external
```

## Packaging & Distribution

### iOS Distribution

#### App Store Build
1. **Archive in Xcode:**
   - Select "Any iOS Device" target
   - Product → Archive
   - Upload to App Store Connect

2. **TestFlight Beta:**
   - Upload archive to App Store Connect
   - Add testers and distribute beta

#### Ad Hoc Distribution
- Configure provisioning profile for device testing
- Build and export IPA for internal distribution

### Android Distribution

#### Google Play Store
```bash
# Build release APK
cd android
./gradlew assembleRelease

# Or build AAB (recommended)
./gradlew bundleRelease
```

#### Direct APK Distribution
- Generate signed APK
- Distribute via direct download or internal channels

## Native Plugin Integration

### Current Plugins
- `@capacitor/core` - Core functionality
- `@capacitor/ios` - iOS platform support  
- `@capacitor/android` - Android platform support

### Future Plugin Additions
```bash
# File system access
npm install @capacitor/filesystem

# Native dialogs
npm install @capacitor/dialog

# Device information
npm install @capacitor/device

# File sharing
npm install @capacitor/share

# Sync with native projects
npx cap sync
```

## Troubleshooting

### Common Issues

#### Build Failures
- **Web build fails**: Check Vite configuration and dependencies
- **Capacitor sync fails**: Ensure `build/` directory exists
- **Native build fails**: Check platform-specific requirements

#### iOS Issues
- **Signing errors**: Configure certificates and provisioning profiles
- **Simulator issues**: Reset simulator or try different device
- **Plugin errors**: Run `npx cap sync` after plugin changes

#### Android Issues
- **Gradle sync fails**: Update Android Studio and SDK
- **Build errors**: Check Java version (requires Java 17+)
- **Emulator issues**: Create new AVD or update emulator

### Debug Commands

```bash
# Check Capacitor installation
npx cap doctor

# List installed plugins
npx cap ls

# Clean and rebuild
npm run build
npx cap sync
```

## Performance Considerations

### Bundle Size
- Main bundle: ~1.5MB (includes full Sila functionality)
- Language files: ~274 additional chunks for syntax highlighting
- Source maps: ~5.7MB (development only)

### Optimization Tips
- Use dynamic imports for large features
- Implement proper code splitting
- Optimize images and assets
- Monitor bundle size with build tools

## Security Considerations

### Data Storage
- Use Capacitor's secure storage APIs
- Implement proper data encryption
- Follow platform security guidelines

### Network Security
- Use HTTPS for all network requests
- Implement proper certificate pinning
- Validate all external data

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