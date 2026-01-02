import { AuthStore, type User } from "./auth.svelte";
import { ThemeStore } from "./theme.svelte";
import { SpaceState } from "./spaceState.svelte";
import { isDevMode, spaceInspectorOpen } from "./devMode";
import { setupSwins, swinsLayout } from "./swinsLayout";
import type { SpacePointer } from "../spaces/SpacePointer";
import { createPersistenceLayersForURI } from "../spaces/persistence/persistenceUtils";
import {
  checkIfCanCreateSpaceAndReturnPath,
  checkIfPathHasValidStructureAndReturnActualRootPath,
  loadSpaceMetadataFromPath,
} from "../spaces/fileSystemSpaceUtils";
import {
  deleteSpace,
  initializeDatabase,
  saveConfig,
  saveCurrentSpaceId,
  savePointers,
} from "@sila/client/localDb";
import { Space, SpaceManager } from "@sila/core";
import { AppFileSystem } from "../appFs";
import type { AppDialogs } from "../appDialogs";
import { uuid } from "@sila/core";
import { toast } from "svelte-sonner";
import { EventStacks } from "../utils/eventStacks";
import { AnalyticsEvents, type AnalyticsName } from "./analyticsEvents";
import { type AnalyticsConfig, AppTelemetry } from "./clientTelemetry";

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export type ClientStateConfig = {
  initState?: ClientState;
  fs?: AppFileSystem;
  dialog?: AppDialogs;
  telemetryConfig?: AnalyticsConfig;
  appVersions?: AppVersions;
};

type SpaceStatus = "disconnected" | "loading" | "ready" | "error";

export type AppVersions = {
  shell: { version: string } | null;
  client: { version: string; source?: string; buildName?: string } | null;
};

/**
 * Central hub for client-side state management.
 * We reference all client-related states here and pass them to components via a Svelte context.
 * See: ClientStateProvider.svelte - this component takes a ClientState instance and shares it in a context
 * that components within ClientStateProvider.svelte can access.
 */
export class ClientState {
  private _init: boolean = $state(false);
  private _initializationError: string | null = $state(null);
  private _spaceManager = new SpaceManager();
  private _defaultTheme: ThemeStore = $state(new ThemeStore());
  private _spaceStates: SpaceState[] = $state([]);
  private _fs: AppFileSystem | null = null;
  private _dialog: AppDialogs | null = null;
  appTelemetry = new AppTelemetry();

  currentSpaceState: SpaceState | null = $state(null); // @TODO: consider making it a derived state
  currentSpace: Space | null = $derived(this.currentSpaceState?.space || null);

  appVersions: AppVersions | null = $state(null);
  appVersion: string | null = $derived(this.appVersions?.client?.version ?? null);
  appVersionSource: string | null = $derived(this.appVersions?.client?.source ?? null);

  // @TODO: can we get rid of them and instead rely on _spaceStates?
  pointers: SpacePointer[] = $state([]);
  currentSpaceId: string | null = $derived(
    this.currentSpaceState?.pointer.id || null,
  );
  config: Record<string, unknown> = $state({});
  auth = new AuthStore();

  spaceStatus: SpaceStatus = $derived.by(() => {
    if (!this.currentSpaceState) {
      return "disconnected";
    }

    if (!this.currentSpaceState.isConnected) {
      return "loading";
    }

    return "ready";
  });

  // @TODO: consider to remove these and just use the status directly
  isInitializing: boolean = $derived(!this._init);
  needsSpace: boolean = $derived(this._init && this.pointers.length === 0);
  isReady: boolean = $derived(this._init && this.pointers.length > 0);
  initializationError: string | null = $derived(this._initializationError);

  theme: ThemeStore = $derived.by(() => {
    // Use current space's theme if available, otherwise global theme
    if (this.currentSpaceState) {
      return this.currentSpaceState.theme;
    } else {
      return this._defaultTheme;
    }
  });

  get toast() {
    return toast;
  }

  get fs(): AppFileSystem {
    if (!this._fs) {
      throw new Error("fs is not set");
    }

    return this._fs;
  }

  get dialog(): AppDialogs {
    if (!this._dialog) {
      throw new Error("dialog is not set");
    }

    return this._dialog;
  }

  dev = {
    isDevMode,
    spaceInspectorOpen,
  };

  // Generic LIFO event stacks (e.g., "close") that components can subscribe to
  events = new EventStacks();

  // Convenience to request a cascading close (used by the global Esc listener)
  requestClose(): boolean {
    return this.events.emit("close");
  }

  track(event: AnalyticsName, props?: Record<string, unknown>): void {
    this.appTelemetry.capture(event, props);
  }

  layout = {
    swins: setupSwins(),

    openSettings: () => {
      this.layout.swins.open(swinsLayout.settings.key, {}, "Settings");
    },
    openSpaces: () => {
      this.layout.swins.open(swinsLayout.spaces.key, {}, "Workspaces");
    },
  };

  async init(initState?: ClientStateConfig): Promise<void> {
    if (this._init) {
      return;
    }

    this._fs = initState?.fs || null;
    this._dialog = initState?.dialog || null;
    this.appVersions = initState?.appVersions ?? null;
    this.appTelemetry.init(initState?.telemetryConfig ?? null);

    await this.loadFromLocalDb();
    this.appTelemetry.capture(AnalyticsEvents.AppOpened, { spaces: this.pointers.length });

    this._init = true;
  }

  /**
   * Single initialization method that handles database loading and everything
   */
  async loadFromLocalDb(): Promise<void> {
    try {
      this._initializationError = null;

      // Initialize database and load space data
      const { pointers, currentSpaceId, config } = await initializeDatabase();
      this.pointers = pointers;
      this.config = config;

      // Create SpaceState instances for all pointers
      this._spaceStates = pointers.map((pointer) =>
        new SpaceState({
          pointer,
          spaceManager: this._spaceManager,
          analytics: this.appTelemetry,
          getAppFs: () => this._fs,
        })
      );

      // Register existing spaces with electron file system for file protocol
      if (typeof window !== "undefined" && (window as any).electronFileSystem) {
        for (const pointer of pointers) {
          (window as any).electronFileSystem.registerSpace(
            pointer.id,
            pointer.uri,
            pointer.name,
            pointer.createdAt,
          );
        }
      }

      // Check authentication and filter spaces (dummy for now)
      await this.auth.checkAuth();
      if (this.auth.isAuthenticated) {
        // @TODO: implement connection to server
      }

      // Set current space and connect to it
      await this._setCurrentSpace(currentSpaceId);

      // Set final status
      this._updateCurrentSpace();
    } catch (error) {
      console.error("Failed to initialize client state:", error);
      this._initializationError = error instanceof Error
        ? error.message
        : String(error);
    }
  }

  /**
   * Switch to a specific space by ID
   */
  async switchToSpace(spaceId: string): Promise<void> {
    if (this.currentSpaceId === spaceId) return;

    await this._setCurrentSpace(spaceId);
    await this._saveState();
  }

  /**
   * Create a new local space using SpaceManager with URI-based persistence
   */
  async createSpace(uri?: string): Promise<string> {
    const space = Space.newSpace(uuid());
    const spaceId = space.getId();

    // If no URI is provided, use the spaceId as the URI
    if (!uri) {
      uri = "local://" + spaceId;
    } else {
      uri = await checkIfCanCreateSpaceAndReturnPath(this, uri);
    }

    const pointer: SpacePointer = {
      id: spaceId,
      uri: uri,
      name: space.name || null,
      createdAt: space.createdAt,
      userId: this.auth.user?.id || null,
    };

    // Create persistence layers based on URI
    const persistenceLayers = createPersistenceLayersForURI(
      spaceId,
      pointer.uri,
      this._fs,
    );

    await this._spaceManager.addNewSpace(space, persistenceLayers);

    // Register space with electron file system for file protocol
    if (typeof window !== "undefined" && (window as any).electronFileSystem) {
      (window as any).electronFileSystem.registerSpace(
        spaceId,
        pointer.uri,
        space.name || null,
        space.createdAt,
      );
    }

    // Add to our collections
    this.pointers = [...this.pointers, pointer];
    const newSpaceState = new SpaceState({
      pointer,
      spaceManager: this._spaceManager,
      analytics: this.appTelemetry,
      getAppFs: () => this._fs,
    });
    this._spaceStates = [...this._spaceStates, newSpaceState];

    // Switch to the new space
    await this.switchToSpace(spaceId);

    this._updateCurrentSpace();
    await this._saveState();
    this.appTelemetry.capture(AnalyticsEvents.SpaceCreated, {
      spaceId,
      uriScheme: pointer.uri.split("://")[0] || "unknown",
    });

    return spaceId;
  }

  /**
   * Add a demo space into the manager without persistence layers.
   * Useful for demos in the workbench where we don't want to persist to IndexedDB or FS.
   */
  async addDemoSpace(space: Space, name?: string): Promise<string> {
    const spaceId = space.getId();

    if (name) {
      space.name = name;
    }

    // Create a local pointer with a memory URI
    const pointer: SpacePointer = {
      id: spaceId,
      uri: `memory://${spaceId}`,
      name: space.name || null,
      createdAt: space.createdAt,
      userId: this.auth.user?.id || null,
    };

    // Add the space to the manager without any persistence layers
    await this._spaceManager.addNewSpace(space, []);

    // Update client state collections
    this.pointers = [...this.pointers, pointer];
    const newSpaceState = new SpaceState({
      pointer,
      spaceManager: this._spaceManager,
      analytics: this.appTelemetry,
      getAppFs: () => this._fs,
    });
    this._spaceStates = [...this._spaceStates, newSpaceState];

    // Switch to the new space without saving to local DB
    await this._setCurrentSpace(spaceId);
    this._updateCurrentSpace();

    // Mark client initialized for in-memory usage scenarios (workbench/tests)
    this._init = true;
    this.appTelemetry.capture(AnalyticsEvents.SpaceCreatedDemo, { spaceId });

    return spaceId;
  }

  /**
   * Remove a space by ID
   */
  async removeSpace(spaceId: string): Promise<void> {
    // Unregister space from electron file system
    if (typeof window !== "undefined" && (window as any).electronFileSystem) {
      (window as any).electronFileSystem.unregisterSpace(spaceId);
    }

    // Find and disconnect the space being removed (since we keep spaces connected now)
    const spaceToRemove = this._spaceStates.find((s) =>
      s.pointer.id === spaceId
    );
    if (spaceToRemove) {
      spaceToRemove.disconnect();
    }

    // Clear current space if it's being removed
    if (this.currentSpaceState?.pointer.id === spaceId) {
      this.currentSpaceState = null;
    }

    // Remove from our collections
    this.pointers = this.pointers.filter((p) => p.id !== spaceId);
    this._spaceStates = this._spaceStates.filter((s) =>
      s.pointer.id !== spaceId
    );

    // Update current space if it was removed
    if (this.currentSpaceId === spaceId) {
      const nextSpaceId = this.pointers.length > 0 ? this.pointers[0].id : null;
      if (nextSpaceId) {
        await this.switchToSpace(nextSpaceId);
      } else {
        // currentSpaceState is already null from the disconnect above
        // currentSpaceId will be derived as null automatically
      }
    }

    // Delete from database
    await deleteSpace(spaceId);

    this._updateCurrentSpace();
   await this._saveState();
  }

  /**
   * Update space name
   */
  async updateSpaceName(spaceId: string, name: string): Promise<void> {
    const existingPointer = this.pointers.find((p) => p.id === spaceId);
    const previousName = existingPointer?.name;

    // Update in pointers
    this.pointers = this.pointers.map((p) =>
      p.id === spaceId ? { ...p, name } : p
    );

    // Update in SpaceState
    const spaceState = this._spaceStates.find((s) => s.pointer.id === spaceId);
    if (spaceState) {
      spaceState.pointer = { ...spaceState.pointer, name };

      if (!spaceState.isConnected) {
        await spaceState.connect();
      }

      // Update loaded space if exists
      if (spaceState.space) {
        spaceState.space.name = name;
      }

      if (previousName !== name) {
        spaceState.spaceTelemetry.spaceRenamed({ space_id: spaceId });
      }
    }

    await this._saveState();
  }

  // === Dummy Auth Functions (until auth is implemented) ===

  /**
   * Dummy implementation - no filtering for now
   */
  private async _filterSpacesForCurrentUser(): Promise<void> {
    // For now, do nothing - all spaces are visible
    // TODO: Implement when auth is needed
  }

  /**
   * Dummy implementation for user sign out
   */
  private async _handleUserSignOut(): Promise<void> {
    // For now, do nothing
    // TODO: Implement when auth is needed
  }

  /**
   * Internal method to set and connect to current space
   */
  private async _setCurrentSpace(spaceId: string | null): Promise<void> {
    const previousSpaceId = this.currentSpaceId;

    // Don't disconnect current space - keep it connected for fast switching
    this.currentSpaceState = null;

    if (!spaceId) return;

    // Find and connect to new space
    const spaceState = this._spaceStates.find((s) => s.pointer.id === spaceId);
    if (spaceState) {
      try {
        this.currentSpaceState = spaceState;

        // Connect if not already connected
        if (!spaceState.isConnected) {
          await spaceState.connect();
        }
        if (this.currentSpaceState) {
          if (previousSpaceId && previousSpaceId !== spaceId) {
            this.currentSpaceState.spaceTelemetry.spaceSwitched({
              from_space_id: previousSpaceId,
              to_space_id: spaceId,
            });
          }
          this.currentSpaceState.spaceTelemetry.spaceEntered({
            space_id: this.currentSpaceState.pointer.id,
          });
        }
      } catch (error) {
        console.log(`Removing space ${spaceId} from SpaceManager`);
        // Don't set currentSpace if connection failed
        this.currentSpaceState = null;
        // Remove the space from the SpaceManager
        this.removeSpace(spaceId);
      }
    }
  }

  // @TODO: not sure if we need this
  private _updateCurrentSpace(): void {
    // Ensure we have a current space selected
    if (!this.currentSpaceState && this.pointers.length > 0) {
      const defaultSpaceId = this.pointers[0].id;
      this._setCurrentSpace(defaultSpaceId);
    }
  }

  /**
   * Explicitly save current state to database
   */
  private async _saveState(): Promise<void> {
    try {
      await Promise.all([
        savePointers(this.pointers),
        saveConfig(this.config),
        saveCurrentSpaceId(this.currentSpaceId),
      ]);
    } catch (error) {
      console.error("Failed to save state:", error);
    }
  }

  /**
   * Orchestrated sign-in workflow (dummy for now)
   */
  async signIn(tokens: AuthTokens, user: User): Promise<void> {
    await this.auth.setAuth(tokens, user);
    // @TODO: implement connection to server
    this._updateCurrentSpace();
    await this._saveState();
  }

  /**
   * Orchestrated sign-out workflow (dummy for now)
   */
  async signOut(): Promise<void> {
    // Disconnect all spaces since we keep them connected during normal operation
    for (const spaceState of this._spaceStates) {
      spaceState.disconnect();
    }
    this.currentSpaceState = null;

    await this.auth.logout();
    await this._handleUserSignOut(); // Dummy
    this._updateCurrentSpace();
    // @TODO: implement disconnect from server
    await this._saveState();
  }

  /**
   * Load an existing space from a given URI
   */
  async loadSpace(uri: string): Promise<string> {
    // We do this because a user might have selected a folder inside the space directory
    const spaceRootPath =
      await checkIfPathHasValidStructureAndReturnActualRootPath(this, uri);

    // Load space metadata from the file system
    const { spaceId } = await loadSpaceMetadataFromPath(this, spaceRootPath);

    // Check if space is already loaded
    const existingPointer = this.pointers.find((p) => p.id === spaceId);
    if (existingPointer) {
      // Space already exists, just switch to it
      await this.switchToSpace(spaceId);
      return spaceId;
    }

    // Create pointer for the file system space
    const pointer: SpacePointer = {
      id: spaceId,
      uri: spaceRootPath, // File system path as URI triggers dual persistence
      name: null, // Will be loaded from space data
      createdAt: new Date(), // Will be updated from space data
      userId: this.auth.user?.id || null,
    };

    // Create persistence layers based on URI (will be IndexedDB + FileSystem)
    const persistenceLayers = createPersistenceLayersForURI(
      spaceId,
      spaceRootPath,
      this._fs,
    );

    // Load the space using SpaceManager
    const space = await this._spaceManager.loadSpace(
      pointer,
      persistenceLayers,
    );

    // Register space with electron file system for file protocol
    if (typeof window !== "undefined" && (window as any).electronFileSystem) {
      (window as any).electronFileSystem.registerSpace(
        spaceId,
        spaceRootPath,
        space.name || null,
        space.createdAt,
      );
    }

    // Update pointer with actual space metadata
    pointer.name = space.name || null;
    pointer.createdAt = space.createdAt;

    // Add to our collections
    this.pointers = [...this.pointers, pointer];
    const newSpaceState = new SpaceState({
      pointer,
      spaceManager: this._spaceManager,
      analytics: this.appTelemetry,
      getAppFs: () => this._fs,
    });
    this._spaceStates = [...this._spaceStates, newSpaceState];

    // Switch to the loaded space
    await this.switchToSpace(spaceId);

    this._updateCurrentSpace();
    await this._saveState();

    return spaceId;
  }

  /**
   * Initialize the entire client state system
   * Used during app startup - kept for backward compatibility
   */
  async initialize(): Promise<void> {
    // Check authentication state
    await this.auth.checkAuth();

    // If authenticated, set up connections
    if (this.auth.isAuthenticated) {
      // @TODO: implement connection to server
    }

    // Load theme for current space
    if (this.currentSpaceState) {
      await this.currentSpaceState.theme.loadSpaceTheme(
        this.currentSpaceState.pointer.id,
      );
    }

    // Try to register spaces with electron file system (in case API is now available)
    this._registerSpacesWithElectron();
  }

  /**
   * Register all current spaces with the electron file system
   */
  private _registerSpacesWithElectron(): void {
    if (typeof window !== "undefined" && (window as any).electronFileSystem) {
      for (const pointer of this.pointers) {
        (window as any).electronFileSystem.registerSpace(
          pointer.id,
          pointer.uri,
          pointer.name,
          pointer.createdAt,
        );
      }
    } else {
      // Poll for API availability
      setTimeout(() => this._registerSpacesWithElectron(), 1000);
    }
  }

  /**
   * Cleanup all client state
   * Used during app shutdown or navigation away
   */
  async cleanup(): Promise<void> {
    // Disconnect all spaces since we keep them connected during switching
    for (const spaceState of this._spaceStates) {
      spaceState.disconnect();
    }
    this.currentSpaceState = null;
    // @TODO: implement disconnect from server
  }
}
