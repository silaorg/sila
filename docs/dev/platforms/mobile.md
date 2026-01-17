# Mobile Platform Build Guide

This document describes how to build and package Sila for mobile platforms (iOS and Android) using Capacitor.

## Overview

The Sila mobile app is built using:
- **Svelte + Vite** for the web layer (simple setup, no SvelteKit)
- **Capacitor** for native mobile integration
- **Client and core packages** for the actual functionality of the app

## Prerequisites

### Required Tools
- **Node.js** (v18+)
- **Xcode** (for iOS builds) - macOS only
- **Android Studio** (for Android builds)

### Platform-Specific Requirements

#### iOS
- macOS with Xcode 14+
- iOS 13+ deployment target
- Apple Developer account (for device testing and App Store)
- Run `xcodebuild -runFirstLaunch` once after installing or updating Xcode

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

### 1. Install dependencies
Run this from the repo root:

```
npm install
```

### 2. Build web assets
Run this from the repo root:

```
npm -w packages/mobile run build
```

This runs:
- `npm -w @sila/client run build`
- `vite build`
- `npx cap sync`

### 3. iOS build
Run these from the repo root:

```
npx cap sync ios
npx cap open ios
```

Build and run in Xcode.

### 4. Android build
Run these from the repo root:

```
npx cap sync android
npx cap open android
```

Build and run in Android Studio.

## Development Workflow

### Local Development
1. Start the dev servers from the repo root: `npm -w packages/mobile run dev`
2. Run on device: `npx cap run ios` or `npx cap run android`
3. Use live reload for faster development

### Native Plugin Integration
- Current plugins: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/filesystem`, `@capacitor/dialog`
- Future plugins: Device info, Share, Camera

### Debug Commands
- `npx cap doctor` - Check Capacitor installation
- `npx cap ls` - List installed plugins
