# Sila Mobile - Capacitor + Svelte

A mobile application built with Capacitor and a thin Svelte wrapper around the client package. This package provides a native mobile experience for Sila using Capacitor's native capabilities for file system access, dialogs, and device integration.

## Architecture

The mobile package follows the same simple structure as the desktop package:
- **Svelte + Vite** for the UI layer (no SvelteKit complexity)
- **Capacitor** for native mobile integration
- **Shared client package** for all core functionality
- **Native mobile features** through Capacitor plugins

## Current Status

✅ **Completed**: Basic Svelte + Vite setup with Capacitor integration
🚧 **In Progress**: Native file system and dialog implementations
📋 **Planned**: Full workspace management and persistence layers

## Build & Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for mobile
npm run build

# Sync with native platforms
npx cap sync
```

## Native Platform Integration

- **iOS**: Native file system access through Capacitor Filesystem API
- **Android**: Platform-specific implementations via Capacitor plugins
- **Web**: Fallback to web APIs when running in browser

## Documentation

- [Mobile Build Guide](../../docs/dev/platforms/mobile.md) - Complete guide for building and packaging for iOS/Android

## Dependencies

- `@capacitor/core` - Core Capacitor functionality
- `@capacitor/ios` - iOS platform support
- `@capacitor/android` - Android platform support
- `@sila/client` - Shared Sila client functionality
- `@sila/core` - Core Sila business logic