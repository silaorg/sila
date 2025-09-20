# Sila Mobile - Capacitor + Svelte

A mobile application built with Capacitor and a thin Svelte wrapper around the client package. This package provides a native mobile experience for Sila using Capacitor's native capabilities for file system access, dialogs, and device integration.

## Architecture

The mobile package follows the same simple structure as the desktop package:
- **Svelte + Vite** for the UI layer (no SvelteKit complexity)
- **Capacitor** for native mobile integration
- **Client and core packages** for the actual functionality of the app
- **Native mobile features** through Capacitor plugins

## Status

🚧 **In Progress**: This mobile implementation is currently under development.

## Documentation

- [Mobile Build Guide](../../docs/dev/platforms/mobile.md) - Complete guide for building and packaging for iOS/Android