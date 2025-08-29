# Space Management & Persistence Architecture

## Overview

Our space management system uses a layered architecture that separates business logic from persistence concerns, enabling flexible storage strategies and environment-agnostic code.

## Core Architecture

```
Space (Business Logic)
    ↓
SpaceManager (Orchestration) 
    ↓  
PersistenceLayer(s) (Storage)
```

### Space
Contains pure business logic for managing space data, app trees, and configurations. Has no knowledge of how or where data is stored.

### SpaceManager  
Environment-agnostic orchestrator that:
- Manages multiple active spaces
- Supports multiple persistence layers per space (e.g., local + server sync)
- Handles space lifecycle (create, load, close)
- Merges operations from multiple sources using RepTree's conflict resolution

### PersistenceLayer
Abstract interface for storage backends with two sync models:
- **One-way (write-only)**: Local storage, databases - saves operations without listening for changes
- **Two-way (bidirectional)**: Real-time sync - saves operations AND receives incoming changes

## Why This Design?

### Benefits of New System
- **Separation of Concerns**: Business logic independent of storage
- **Composability**: Mix multiple persistence strategies per space (e.g., local + server)
- **Environment Agnostic**: Same SpaceManager works on client and server
- **Extensibility**: Add new storage types without changing existing code
- **Testability**: Easy to mock persistence layers

## How Multiple Persistence Works

When a space has multiple persistence layers:

1. **Loading**: Operations loaded from all layers, RepTree merges and resolves conflicts
2. **Saving**: New operations saved to all layers in parallel  
3. **Two-way sync**: Incoming changes from any layer applied to the space
4. **Secrets**: Merged from all layers, saved to all layers

This enables scenarios like:
- **Local + Server**: Auto-sync with offline capability
- **Multiple servers**: Cross-platform synchronization
- **Local + Backup**: Redundant storage

## Implementation

### Client Implementation
- `IndexedDBPersistenceLayer`: One-way local storage using IndexedDB
- `ServerPersistenceLayer`: Two-way sync with HTTP/WebSocket APIs  
- `spaceManagerSetup.ts`: Factory functions for creating space connections

### Server Implementation  
- `SQLitePersistenceLayer`: One-way database persistence
- Same `SpaceManager` interface as client

## Current Status

**✅ Working**: Local-only spaces with IndexedDB persistence
**🚧 Next**: Server persistence layers and two-way sync capabilities

The system is fully operational for local spaces and ready for extension with additional persistence strategies. 