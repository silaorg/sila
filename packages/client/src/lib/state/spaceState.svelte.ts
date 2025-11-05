import { ThemeStore } from "./theme.svelte";
import { LayoutStore } from "./layout.svelte";
import type { SpacePointer } from "../spaces/SpacePointer";
import type { Space, Vertex } from "@sila/core";
import type { SpaceManager } from "@sila/core";
import type { PersistenceLayer } from "@sila/core";
import { createPersistenceLayersForURI } from "../spaces/persistence/persistenceUtils";
import type { AppFileSystem } from "../appFs";
import {
  getDraft,
  saveDraft,
  deleteDraft,
  getAllSecrets,
  saveAllSecrets,
  getSecret,
  setSecret
} from "@sila/client/localDb";
import { Backend, FileResolver } from "@sila/core";
import VertexViewer from "./vertexViewer.svelte";

export class SpaceState {
  pointer: SpacePointer;
  private spaceManager: SpaceManager;
  space: Space | null = null;
  theme: ThemeStore = $state(new ThemeStore());
  layout: LayoutStore = $state(new LayoutStore(''));
  vertexViewer: VertexViewer;
  fileResolver: FileResolver;
  isConnected: boolean = $state(false);
  private persistenceLayers: PersistenceLayer[] = [];
  private getAppFs: () => AppFileSystem | null;

  private backend: Backend | null = null;

  constructor(pointer: SpacePointer, spaceManager: SpaceManager, getAppFs: () => AppFileSystem | null = () => null) {
    this.pointer = pointer;
    this.spaceManager = spaceManager;
    this.getAppFs = getAppFs;
    this.layout.spaceId = pointer.id;

    const space = this.spaceManager.getSpace(pointer.id);
    if (!space) {
      throw new Error(`Space not found: ${pointer.id}`);
    }

    this.space = space;
    this.persistenceLayers = this.spaceManager.getPersistenceLayers(pointer.id) || [];
    this.fileResolver = new FileResolver(space);
    this.vertexViewer = new VertexViewer(space);

    let allConnected = true;
    for (const layer of this.persistenceLayers) {
      if (!layer.isConnected()) {
        allConnected = false;
        break;
      }
    }

    if (allConnected) {
      this.initBackend();
    }

    this.isConnected = allConnected;

  }

  /**
   * Connect to this space - loads the actual Space data from persistence
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.space) return;

    try {
      // Load the actual space using SpaceManager
      this.space = await this.loadSpace();

      if (this.space) {
        // Load space-specific theme and layout
        await this.theme.loadSpaceTheme(this.pointer.id);
        await this.layout.loadSpaceLayout();

        this.initBackend();

        this.isConnected = true;
      } else {
        throw new Error(`Failed to load space ${this.pointer.id}`);
      }
    } catch (error) {
      console.error(`Failed to connect to space ${this.pointer.id}:`, error);
      throw error;
    }
  }

  initBackend(): void {
    if (!this.space) {
      throw new Error("Space is not loaded");
    }

    this.backend = new Backend(this.space, this.pointer.uri.startsWith("local://"));
  }

  /**
   * Disconnect from this space - keeps theme/layout but clears space data
   */
  disconnect(): void {
    // Close the space in SpaceManager if loaded
    if (this.space) {
      this.spaceManager.closeSpace(this.pointer.id).catch(console.error);
    }

    this.space = null;
    this.isConnected = false;
  }

  /**
   * Load the space using SpaceManager with appropriate persistence layers
   */
  private async loadSpace(): Promise<Space | null> {
    // Check if already loaded in SpaceManager
    let space = this.spaceManager.getSpace(this.pointer.id);
    if (space) return space;

    try {
      // Create appropriate persistence layers based on URI
      // Prefer existing layers from SpaceManager; otherwise construct using app FS provider
      this.persistenceLayers = this.spaceManager.getPersistenceLayers(this.pointer.id) || createPersistenceLayersForURI(this.pointer.id, this.pointer.uri, this.getAppFs());

      // Load the space using SpaceManager
      space = await this.spaceManager.loadSpace(this.pointer, this.persistenceLayers);
      return space;
    } catch (error) {
      console.error("Failed to load space", this.pointer, error);
      console.log("Disconnecting space");
      try {
        await this.spaceManager.closeSpace(this.pointer.id);
      } catch (error) {
        console.error("Failed to disconnect space", error);
      }

      throw error;
    }
  }

  // === Space-specific operations moved from SpaceStore ===

  /**
   * Get a draft for this space
   */
  async getDraft(draftId: string): Promise<string | undefined> {
    return getDraft(this.pointer.id, draftId);
  }

  /**
   * Save a draft for this space
   */
  async saveDraft(draftId: string, content: string): Promise<void> {
    await saveDraft(this.pointer.id, draftId, content);
  }

  /**
   * Delete a draft for this space
   */
  async deleteDraft(draftId: string): Promise<void> {
    await deleteDraft(this.pointer.id, draftId);
  }

  /**
   * Get all secrets for this space
   */
  async getAllSecrets(): Promise<Record<string, string> | undefined> {
    return getAllSecrets(this.pointer.id);
  }

  /**
   * Save all secrets for this space
   */
  async saveAllSecrets(secrets: Record<string, string>): Promise<void> {
    await saveAllSecrets(this.pointer.id, secrets);
  }

  /**
   * Get a specific secret for this space
   */
  async getSecret(key: string): Promise<string | undefined> {
    return getSecret(this.pointer.id, key);
  }

  /**
   * Set a specific secret for this space
   */
  async setSecret(key: string, value: string): Promise<void> {
    await setSecret(this.pointer.id, key, value);
  }

  // === Utility methods ===

  /**
   * Check if this space state matches a pointer
   */
  matches(pointer: SpacePointer): boolean {
    return this.pointer.id === pointer.id;
  }

  /**
   * Get display name for this space
   */
  get displayName(): string {
    return this.pointer.name || this.pointer.id;
  }

  /**
   * Check if this space has model providers setup
   */
  get hasModelProviders(): boolean {
    if (!this.space) return false;
    const providersVertex = this.space.tree.getVertexByPath("providers");
    return providersVertex ? providersVertex.children.length > 0 : false;
  }

  /**
   * Check if this space is local (no user association)
   */
  get isLocal(): boolean {
    return this.pointer.userId === null;
  }

  /**
   * Check if current user owns this space
   */
  isOwnedByUser(userId: string | null): boolean {
    return this.pointer.userId === userId;
  }
} 