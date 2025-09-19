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
│   ├── capacitorFsWrapper.ts   # Capacitor file system implementation
│   ├── capacitorDialogsWrapper.ts # Capacitor dialogs implementation
│   └── capacitorStorageWrapper.ts # Capacitor storage implementation
├── capacitor.config.ts
└── package.json
```

### 2. Capacitor-First File System Implementation

Create `CapacitorFsWrapper` implementing `AppFileSystem` interface using Capacitor's native capabilities:

```typescript
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export class CapacitorFsWrapper implements AppFileSystem {
  private baseDir = Directory.Data; // App-specific data directory
  
  async readDir(path: string): Promise<FileEntry[]> {
    const result = await Filesystem.readdir({
      path: path,
      directory: this.baseDir
    });
    return result.files.map(file => ({
      name: file.name,
      isDirectory: file.type === 'directory',
      isFile: file.type === 'file'
    }));
  }

  async readTextFile(path: string): Promise<string> {
    const result = await Filesystem.readFile({
      path: path,
      directory: this.baseDir,
      encoding: Encoding.UTF8
    });
    return result.data as string;
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await Filesystem.writeFile({
      path: path,
      data: content,
      directory: this.baseDir,
      encoding: Encoding.UTF8
    });
  }

  // Implement all other AppFileSystem methods using Capacitor APIs
}
```

### 3. Capacitor Native Dialogs & Storage

**Capacitor Dialogs Implementation**:
```typescript
import { Dialog } from '@capacitor/dialog';
import { Filesystem, Directory } from '@capacitor/filesystem';

export class CapacitorDialogsWrapper implements AppDialogs {
  async openDialog(opts: OpenDialogOptions): Promise<string | string[] | null> {
    // Use native file picker or custom implementation
    // For mobile, we'll implement a custom file browser
    return await this.showFilePicker(opts);
  }

  async saveDialog(opts: SaveDialogOptions): Promise<string | null> {
    // Use native save dialog or custom implementation
    return await this.showSaveDialog(opts);
  }

  async showInfo(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    await Dialog.alert({
      title: opts.title || 'Information',
      message: opts.message,
      buttonTitle: 'OK'
    });
    return { response: 0 };
  }

  // Implement all other dialog methods using Capacitor Dialog API
}
```

**Capacitor Storage for Preferences**:
```typescript
import { Preferences } from '@capacitor/preferences';

export class CapacitorStorageWrapper {
  async get(key: string): Promise<string | null> {
    const result = await Preferences.get({ key });
    return result.value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
```

**Required Capacitor Plugins**:
- `@capacitor/filesystem` - Native file system access
- `@capacitor/preferences` - Key-value storage (replaces localStorage)
- `@capacitor/dialog` - Native alert/confirm dialogs
- `@capacitor/share` - Native file sharing
- `@capacitor/camera` - Camera integration for file capture
- `@capacitor/device` - Device information
- `@capacitor/network` - Network status monitoring

### 4. Capacitor-Based Persistence Strategy

**Capacitor-Native Approach**:
1. **Capacitor Filesystem**: For workspace data and files (primary storage)
2. **Capacitor Preferences**: For app configuration and user preferences
3. **IndexedDB**: For complex data structures and caching
4. **Cloud Storage**: For cross-device sync (future enhancement)

**Capacitor Persistence Layer**:
```typescript
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export class CapacitorPersistenceLayer extends ConnectedPersistenceLayer {
  private baseDir = Directory.Data;
  private spacePath: string;

  constructor(private spaceId: string, private fs: CapacitorFsWrapper) {
    super();
    this.spacePath = `spaces/${spaceId}`;
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    const opsPath = `${this.spacePath}/ops/${treeId}.json`;
    const opsData = JSON.stringify(ops);
    
    await this.fs.writeTextFile(opsPath, opsData);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    const opsPath = `${this.spacePath}/ops/${treeId}.json`;
    
    if (!await this.fs.exists(opsPath)) {
      return [];
    }
    
    const opsData = await this.fs.readTextFile(opsPath);
    return JSON.parse(opsData);
  }

  // Implement all persistence methods using Capacitor Filesystem
}
```

**Mobile Persistence Layer Selection**:
```typescript
export function createMobilePersistenceLayers(spaceId: string, uri: string): PersistenceLayer[] {
  const layers: PersistenceLayer[] = [];
  
  if (uri.startsWith("local://")) {
    // Local-only spaces: Capacitor Filesystem + IndexedDB for caching
    layers.push(new CapacitorPersistenceLayer(spaceId, capacitorFsWrapper));
    layers.push(new IndexedDBPersistenceLayer(spaceId)); // For caching
  } else if (uri.startsWith("cloud://")) {
    // Future: Cloud-synced spaces
    layers.push(new CapacitorPersistenceLayer(spaceId, capacitorFsWrapper));
    layers.push(new IndexedDBPersistenceLayer(spaceId));
    // layers.push(new CloudPersistenceLayer(spaceId, uri));
  } else {
    // File system paths: Capacitor Filesystem only
    layers.push(new CapacitorPersistenceLayer(spaceId, capacitorFsWrapper));
  }
  
  return layers;
}
```

### 5. Mobile-Specific Features with Capacitor

**File Sharing & Import/Export**:
```typescript
import { Share } from '@capacitor/share';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export class CapacitorFileManager {
  async shareFile(filePath: string, title: string): Promise<void> {
    const fileUri = await Filesystem.getUri({
      directory: Directory.Data,
      path: filePath
    });
    
    await Share.share({
      title: title,
      url: fileUri.uri,
      dialogTitle: 'Share Sila Workspace'
    });
  }

  async capturePhoto(): Promise<string> {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera
    });
    
    return image.webPath!;
  }

  async importFromGallery(): Promise<string> {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos
    });
    
    return image.webPath!;
  }
}
```

**Device & Network Monitoring**:
```typescript
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';

export class CapacitorDeviceManager {
  async getDeviceInfo() {
    const info = await Device.getInfo();
    return {
      platform: info.platform,
      model: info.model,
      osVersion: info.osVersion,
      isVirtual: info.isVirtual
    };
  }

  async monitorNetworkStatus() {
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType
    };
  }
}
```

### 6. Workspace Management for Mobile

**Mobile-Specific Workspace Types**:
1. **Capacitor Workspaces**: Stored in Capacitor Filesystem with IndexedDB caching
2. **Cloud Workspaces**: Synced with cloud storage (future)
3. **Import/Export**: Native file sharing for workspace transfer

**Capacitor Workspace Creation Flow**:
```typescript
// Mobile workspace creation using Capacitor
async createMobileSpace(name?: string): Promise<string> {
  const space = Space.newSpace(uuid());
  const spaceId = space.getId();
  
  // Use capacitor:// URI for mobile spaces
  const uri = "capacitor://" + spaceId;
  
  // Create pointer
  const pointer: SpacePointer = {
    id: spaceId,
    uri: uri,
    name: name || "Mobile Space",
    createdAt: space.createdAt,
    userId: this.auth.user?.id || null,
  };
  
  // Use Capacitor-based persistence
  const persistenceLayers = createMobilePersistenceLayers(spaceId, uri);
  
  // Add to space manager and client state
  await this._spaceManager.addNewSpace(space, persistenceLayers);
  
  // Store workspace metadata in Capacitor Preferences
  await this.capacitorStorage.set(`workspace_${spaceId}`, JSON.stringify(pointer));
  
  return spaceId;
}

// Workspace import/export using Capacitor Share
async exportWorkspace(spaceId: string): Promise<void> {
  const workspacePath = `spaces/${spaceId}`;
  const exportData = await this.capacitorFs.readTextFile(`${workspacePath}/export.json`);
  
  await this.capacitorFileManager.shareFile(
    `${workspacePath}/export.json`,
    `Sila Workspace: ${this.getSpaceName(spaceId)}`
  );
}

async importWorkspace(): Promise<string> {
  // Use Capacitor file picker or share to import workspace
  const importedData = await this.showImportDialog();
  const spaceId = await this.createSpaceFromImport(importedData);
  return spaceId;
}
```

## Implementation Plan

### Phase 1: Capacitor Core Infrastructure (Week 1-2)

1. **Simplify Mobile Structure**:
   - Remove SvelteKit, use simple Svelte like desktop
   - Create `MobileApp.svelte` component
   - Set up proper Capacitor build configuration

2. **Install & Configure Capacitor Plugins**:
   ```bash
   npm install @capacitor/filesystem @capacitor/preferences @capacitor/dialog
   npm install @capacitor/share @capacitor/camera @capacitor/device @capacitor/network
   npx cap sync
   ```

3. **Implement Capacitor File System**:
   - Create `CapacitorFsWrapper` class
   - Implement all `AppFileSystem` methods using Capacitor Filesystem API
   - Test file operations in app-specific directories

4. **Implement Capacitor Dialogs**:
   - Create `CapacitorDialogsWrapper` class
   - Implement all `AppDialogs` methods using Capacitor Dialog API
   - Add native file picker and camera integration

### Phase 2: Capacitor Persistence & Workspace Management (Week 3-4)

1. **Capacitor Persistence Layer**:
   - Create `CapacitorPersistenceLayer` class
   - Modify `createPersistenceLayersForURI` for mobile
   - Implement Capacitor Filesystem-based storage
   - Test workspace creation and loading with native storage

2. **Capacitor Workspace Operations**:
   - Implement mobile workspace creation using Capacitor storage
   - Add workspace switching functionality
   - Implement native workspace import/export using Capacitor Share
   - Store workspace metadata in Capacitor Preferences

3. **Capacitor File Operations**:
   - Test file reading/writing through Capacitor Filesystem
   - Implement native file sharing using Capacitor Share
   - Add camera integration using Capacitor Camera
   - Implement photo import from gallery

### Phase 3: Mobile UI/UX & Native Features (Week 5-6)

1. **Mobile UI Components**:
   - Adapt existing components for mobile screens
   - Implement touch-friendly interactions
   - Add mobile-specific navigation patterns
   - Integrate Capacitor device info for platform-specific UI

2. **Capacitor Native Features**:
   - Implement device-specific optimizations using Capacitor Device API
   - Add network status monitoring using Capacitor Network API
   - Implement native file sharing workflows
   - Add camera integration for file capture and import

3. **Performance & Testing**:
   - Optimize for mobile hardware constraints
   - Test Capacitor plugins on iOS and Android devices
   - Implement proper error handling for native APIs
   - Optimize app size and performance

## Technical Considerations

### Capacitor Plugin Requirements

```json
{
  "dependencies": {
    "@capacitor/core": "^7.0.0",
    "@capacitor/filesystem": "^7.0.0",
    "@capacitor/preferences": "^7.0.0", 
    "@capacitor/dialog": "^7.0.0",
    "@capacitor/share": "^7.0.0",
    "@capacitor/camera": "^7.0.0",
    "@capacitor/device": "^7.0.0",
    "@capacitor/network": "^7.0.0"
  }
}
```

### Capacitor-Specific Advantages

1. **Native File System Access**: Full access to app-specific directories
2. **Native Dialogs**: Platform-specific dialog implementations
3. **File Sharing**: Native sharing capabilities across apps
4. **Camera Integration**: Direct camera access for file capture
5. **Device Information**: Access to device capabilities and status
6. **Network Monitoring**: Real-time network status updates

### Mobile-Specific Limitations

1. **No File System Watching**: Capacitor doesn't support file watching (use polling)
2. **Sandboxed Storage**: Only app-specific directories accessible
3. **Storage Constraints**: Must be mindful of device storage limits
4. **Background Limitations**: Limited background processing capabilities
5. **Platform Differences**: iOS vs Android have different file system behaviors

### Security Considerations

1. **Data Encryption**: Encrypt sensitive data in Capacitor Filesystem
2. **Secure Storage**: Use Capacitor Preferences for secure key-value storage
3. **File Access**: Implement proper file access controls in app directories
4. **Network Security**: Secure any cloud storage integration
5. **Native Security**: Leverage platform-specific security features through Capacitor

## Success Metrics

1. **Functional Parity**: Core Sila features work on mobile using Capacitor
2. **Native Performance**: App leverages native capabilities for optimal performance
3. **Storage Efficiency**: Efficient use of Capacitor Filesystem and device storage
4. **User Experience**: Intuitive mobile interface with native feel
5. **Cross-Platform**: Works consistently on iOS and Android using Capacitor
6. **Native Integration**: Seamless integration with device features (camera, sharing, etc.)

## Future Enhancements

1. **Cloud Storage Integration**: Sync workspaces across devices using Capacitor
2. **Offline-First**: Robust offline functionality with Capacitor storage
3. **Advanced Native Features**: 
   - Voice input using Capacitor plugins
   - Biometric authentication
   - Push notifications
   - Background sync
4. **Desktop-Mobile Sync**: Seamless workspace sharing using Capacitor Share
5. **Progressive Web App**: Web-based mobile version with Capacitor fallbacks
6. **Platform-Specific Features**: 
   - iOS Shortcuts integration
   - Android widgets
   - Platform-specific UI adaptations

## Conclusion

This proposal provides a comprehensive plan for bringing Sila to mobile devices using Capacitor's native capabilities while maintaining the core functionality that makes it powerful on desktop. The Capacitor-first approach ensures we can deliver a truly native mobile experience.

The key insight is that mobile Sila will leverage Capacitor's native APIs for:
- **File System**: Using Capacitor Filesystem for app-specific storage
- **Dialogs**: Using Capacitor Dialog for native platform dialogs  
- **Storage**: Using Capacitor Preferences for secure key-value storage
- **Sharing**: Using Capacitor Share for native file sharing
- **Camera**: Using Capacitor Camera for file capture and import
- **Device Info**: Using Capacitor Device for platform-specific optimizations

This approach maintains the local-first philosophy while providing a truly native mobile experience that feels integrated with the platform. By using Capacitor's comprehensive plugin ecosystem, we can deliver mobile-specific features that go beyond what a simple web app could provide.

By following this plan, we can deliver a mobile version of Sila that not only provides the core workspace and file management capabilities users expect, but also leverages native mobile features for an enhanced user experience. The Capacitor-based architecture provides a solid foundation for future enhancements like cloud sync, advanced native features, and platform-specific optimizations.