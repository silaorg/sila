# Mobile Application Development - Version 1 Proposal

## Executive Summary

This proposal outlines the development plan for transitioning Sila from a desktop-only application to a fully functional mobile platform. The current mobile implementation is a basic SvelteKit + Capacitor setup that lacks the core file system and workspace management capabilities that make Sila powerful on desktop.

## Current State Analysis

### Desktop Architecture

The desktop application (`@sila/desktop`) is built with:
- **Electron** for native desktop integration
- **Svelte** for the UI layer
- **Dual persistence**: IndexedDB + FileSystem for workspaces
- **Custom file protocol** (`sila://`) for secure file access
- **Space management** with full file system integration

#### Key Desktop Components:

1. **File System Integration**:
   - `FileSystemPersistenceLayer` - Saves operations and files to local filesystem
   - `ElectronFsWrapper` - Implements `AppFileSystem` interface using Electron APIs
   - Custom file protocol for secure file access via `sila://` URLs
   - File watching for real-time synchronization

2. **Workspace Management**:
   - Multiple workspaces with persistent storage
   - Space registration with Electron file system
   - Dual persistence (IndexedDB + FileSystem) for file-based workspaces
   - Local-only spaces using IndexedDB only

3. **Client State Management**:
   - `ClientState` class orchestrates all app state
   - Space switching and management
   - Theme and layout persistence
   - Authentication state management

### Mobile WIP Analysis

The current mobile implementation (`@sila/mobile`) has:
- **Capacitor** for native mobile integration
- **SvelteKit** (needs simplification to match desktop)
- **Basic setup** but missing core functionality
- **No file system integration**
- **No workspace management**
- **No persistence layers**

#### Current Mobile Limitations:

1. **No File System Access**: Mobile app passes `config={null}` to `SilaApp`, meaning no file system or dialog implementations
2. **No Workspace Management**: Cannot create, load, or manage workspaces
3. **No File Operations**: Cannot read, write, or manage files
4. **No Persistence**: No way to save or load application state
5. **Architecture Mismatch**: Uses SvelteKit instead of simple Svelte like desktop

## Mobile Requirements & Challenges

### Core Requirements

1. **File System Access**: Mobile apps need alternative approaches to file access
2. **Workspace Management**: Must work within mobile storage constraints
3. **Persistence**: Need mobile-appropriate storage solutions
4. **UI Adaptation**: Touch-friendly interface for smaller screens
5. **Performance**: Optimized for mobile hardware constraints

### Mobile-Specific Challenges

1. **Sandboxed File System**: Mobile apps have limited file system access
2. **Storage Limitations**: Mobile devices have storage constraints
3. **Security Model**: Different security model than desktop
4. **Platform Differences**: iOS vs Android have different capabilities
5. **Network Dependency**: Mobile apps often rely on cloud storage

## Proposed Mobile Architecture

### 1. Simplified Mobile Structure

**Change from SvelteKit to Simple Svelte** (matching desktop):
```
packages/mobile/
├── src/
│   ├── main.ts              # Entry point
│   ├── MobileApp.svelte     # Main app component
│   ├── mobileFsWrapper.ts   # Mobile file system implementation
│   └── mobileDialogsWrapper.ts # Mobile dialogs implementation
├── capacitor.config.ts
└── package.json
```

### 2. Mobile File System Implementation

Create `MobileFsWrapper` implementing `AppFileSystem` interface:

```typescript
export class MobileFsWrapper implements AppFileSystem {
  // Use Capacitor Filesystem plugin for file operations
  // Implement all required methods:
  // - readDir, exists, readTextFile, writeTextFile
  // - create, open, mkdir, watch, readBinaryFile
}
```

**Capacitor Plugins Needed**:
- `@capacitor/filesystem` - File system access
- `@capacitor/preferences` - Key-value storage
- `@capacitor/share` - File sharing capabilities
- `@capacitor/camera` - Camera integration for file capture

### 3. Mobile Persistence Strategy

**Hybrid Approach**:
1. **IndexedDB Only**: For local-only spaces (primary mobile approach)
2. **Cloud Storage**: For file-based workspaces (future enhancement)
3. **Capacitor Storage**: For app preferences and configuration

**Persistence Layer Selection**:
```typescript
export function createMobilePersistenceLayers(spaceId: string, uri: string): PersistenceLayer[] {
  if (uri.startsWith("local://")) {
    // Local-only spaces: IndexedDB only
    return [new IndexedDBPersistenceLayer(spaceId)];
  } else if (uri.startsWith("cloud://")) {
    // Future: Cloud-synced spaces
    return [new IndexedDBPersistenceLayer(spaceId), new CloudPersistenceLayer(spaceId, uri)];
  } else {
    // File system paths: IndexedDB only (mobile limitation)
    return [new IndexedDBPersistenceLayer(spaceId)];
  }
}
```

### 4. Mobile Dialog Implementation

Create `MobileDialogsWrapper` implementing `AppDialogs` interface:

```typescript
export class MobileDialogsWrapper implements AppDialogs {
  // Use Capacitor plugins for native dialogs
  // - File picker for open/save dialogs
  // - Native alert dialogs for messages
  // - Camera integration for file capture
}
```

### 5. Workspace Management for Mobile

**Mobile-Specific Workspace Types**:
1. **Local Workspaces**: Stored entirely in IndexedDB
2. **Cloud Workspaces**: Synced with cloud storage (future)
3. **Import/Export**: Allow importing desktop workspaces

**Workspace Creation Flow**:
```typescript
// Mobile workspace creation
async createMobileSpace(name?: string): Promise<string> {
  const space = Space.newSpace(uuid());
  const spaceId = space.getId();
  
  // Use local:// URI for mobile spaces
  const uri = "local://" + spaceId;
  
  // Create pointer
  const pointer: SpacePointer = {
    id: spaceId,
    uri: uri,
    name: name || "Mobile Space",
    createdAt: space.createdAt,
    userId: this.auth.user?.id || null,
  };
  
  // Use IndexedDB-only persistence
  const persistenceLayers = [new IndexedDBPersistenceLayer(spaceId)];
  
  // Add to space manager and client state
  await this._spaceManager.addNewSpace(space, persistenceLayers);
  // ... rest of implementation
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

1. **Simplify Mobile Structure**:
   - Remove SvelteKit, use simple Svelte like desktop
   - Create `MobileApp.svelte` component
   - Set up proper build configuration

2. **Implement Mobile File System**:
   - Install required Capacitor plugins
   - Create `MobileFsWrapper` class
   - Implement all `AppFileSystem` methods using Capacitor APIs

3. **Implement Mobile Dialogs**:
   - Create `MobileDialogsWrapper` class
   - Implement all `AppDialogs` methods using Capacitor APIs
   - Add file picker and camera integration

### Phase 2: Workspace Management (Week 3-4)

1. **Mobile Persistence**:
   - Modify `createPersistenceLayersForURI` for mobile
   - Ensure IndexedDB-only persistence works correctly
   - Test workspace creation and loading

2. **Workspace Operations**:
   - Implement mobile workspace creation
   - Add workspace switching functionality
   - Implement workspace import/export

3. **File Operations**:
   - Test file reading/writing through mobile file system
   - Implement file sharing capabilities
   - Add camera integration for file capture

### Phase 3: UI/UX Adaptation (Week 5-6)

1. **Mobile UI Components**:
   - Adapt existing components for mobile screens
   - Implement touch-friendly interactions
   - Add mobile-specific navigation patterns

2. **Performance Optimization**:
   - Optimize for mobile hardware constraints
   - Implement lazy loading where appropriate
   - Test on various mobile devices

3. **Testing & Polish**:
   - Test on iOS and Android devices
   - Fix mobile-specific bugs
   - Optimize app size and performance

## Technical Considerations

### Capacitor Plugin Requirements

```json
{
  "dependencies": {
    "@capacitor/filesystem": "^7.0.0",
    "@capacitor/preferences": "^7.0.0", 
    "@capacitor/share": "^7.0.0",
    "@capacitor/camera": "^7.0.0",
    "@capacitor/device": "^7.0.0"
  }
}
```

### Mobile-Specific Limitations

1. **No File System Watching**: Mobile apps cannot watch file system changes
2. **Limited File Access**: Only app-specific directories accessible
3. **Storage Constraints**: Must be mindful of device storage limits
4. **Background Limitations**: Limited background processing capabilities

### Security Considerations

1. **Data Encryption**: Encrypt sensitive data in IndexedDB
2. **Secure Storage**: Use Capacitor's secure storage for secrets
3. **File Access**: Implement proper file access controls
4. **Network Security**: Secure any cloud storage integration

## Success Metrics

1. **Functional Parity**: Core Sila features work on mobile
2. **Performance**: App loads and responds quickly on mobile devices
3. **Storage Efficiency**: Efficient use of mobile storage
4. **User Experience**: Intuitive mobile interface
5. **Cross-Platform**: Works consistently on iOS and Android

## Future Enhancements

1. **Cloud Storage Integration**: Sync workspaces across devices
2. **Offline-First**: Robust offline functionality
3. **Mobile-Specific Features**: Camera integration, voice input, etc.
4. **Desktop-Mobile Sync**: Seamless workspace sharing between platforms
5. **Progressive Web App**: Web-based mobile version

## Conclusion

This proposal provides a comprehensive plan for bringing Sila to mobile devices while maintaining the core functionality that makes it powerful on desktop. The phased approach ensures we can deliver a working mobile app quickly while building toward a more sophisticated mobile experience.

The key insight is that mobile Sila will primarily use IndexedDB-only persistence for local workspaces, with future cloud integration for cross-device synchronization. This approach maintains the local-first philosophy while adapting to mobile platform constraints.

By following this plan, we can deliver a mobile version of Sila that provides the core workspace and file management capabilities users expect, while laying the groundwork for future enhancements like cloud sync and mobile-specific features.