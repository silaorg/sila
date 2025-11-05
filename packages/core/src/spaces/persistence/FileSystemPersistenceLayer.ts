import { ConnectedPersistenceLayer } from "@sila/core";
import type { VertexOperation } from "@sila/core";
import {
  isMoveVertexOp,
  isAnyPropertyOp,
  newMoveVertexOp,
  newSetVertexPropertyOp
} from "@sila/core";
import { type WatchEvent, type UnwatchFn, type FileHandle, type AppFileSystem } from "@sila/core";
import { interval } from "@sila/core";
import { OpsParser } from "./OpsParser";
import { equalsOpId } from "reptree";

export const LOCAL_SPACE_MD_FILE = 'sila.md';
export const TEXT_INSIDE_LOCAL_SPACE_MD_FILE = `# Sila Space

This directory contains a Sila space. Please do not rename or modify the 'space-v1' folder as you won't be able to open the space from Sila. Sila needs it as is.`;

/**
 * File system persistence layer that saves operations and secrets to local files.
 */
export class FileSystemPersistenceLayer extends ConnectedPersistenceLayer {
  readonly id: string;
  readonly type = 'local' as const;

  private unwatchSpaceFsChanges: UnwatchFn | null = null;
  private saveOpsTimer: (() => void) | null = null;
  private savingOpsToFile = false;
  private treeOpsToSave = new Map<string, VertexOperation[]>();
  private saveOpsIntervalMs = 500;
  private saveSecretsTimer: (() => void) | null = null;
  private saveSecretsIntervalMs = 1000;
  private secretsWriteChain: Promise<void> = Promise.resolve();
  private onIncomingOpsCallback: ((treeId: string, ops: VertexOperation[]) => void) | null = null;
  private savedPeerIds = new Set<string>();
  private opsParser: OpsParser;

  constructor(
    private spacePath: string, 
    private spaceId: string,
    private fs: AppFileSystem
  ) {
    super();
    this.id = `filesystem-${spaceId}`;
    this.opsParser = new OpsParser();
  }

  getFileStoreProvider() {
    return {
      getSpaceRootPath: () => this.spacePath,
      getFs: () => this.fs
    };
  }

  protected async doConnect(): Promise<void> {
    // Ensure space directory structure exists
    await this.ensureDirectoryStructure();
  }

  protected async doDisconnect(): Promise<void> {
    if (this.unwatchSpaceFsChanges) {
      this.unwatchSpaceFsChanges();
      this.unwatchSpaceFsChanges = null;
    }

    if (this.saveOpsTimer) {
      this.saveOpsTimer();
      this.saveOpsTimer = null;
    }

    if (this.saveSecretsTimer) {
      this.saveSecretsTimer();
      this.saveSecretsTimer = null;
    }

    // Ensure any pending ops and secrets are flushed before teardown
    await this.saveOps();
    await this.secretsWriteChain;

    // Clean up the ops parser
    this.opsParser.destroy();
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    if (!this.isConnected()) {
      throw new Error('FileSystemPersistenceLayer not connected');
    }

    return await this.loadAllTreeOps(this.spaceId);
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {    
    if (!this.isConnected()) {
      throw new Error('FileSystemPersistenceLayer not connected');
    }

    if (ops.length === 0) return;

    // Filter out transient properties and add to save queue
    const opsToSave = ops.filter(op => !isAnyPropertyOp(op) || !op.transient);
    if (opsToSave.length === 0) return;

    this.addOpsToSave(treeId, opsToSave);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    if (!this.isConnected()) {
      throw new Error('FileSystemPersistenceLayer not connected');
    }

    return await this.loadAllTreeOps(treeId);
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    if (!this.isConnected()) {
      throw new Error('FileSystemPersistenceLayer not connected');
    }

    return await this.readSecretsFromFile();
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('FileSystemPersistenceLayer not connected');
    }

    if (Object.keys(secrets).length === 0) return;

    // Serialize writes to avoid last-writer-wins race conditions
    this.secretsWriteChain = this.secretsWriteChain.then(async () => {
      const existing = await this.readSecretsFromFile();
      const merged = { ...(existing || {}), ...secrets };
      await this.writeSecretsToFile(merged);
    });

    await this.secretsWriteChain;
  }

  async startListening?(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void> {
    this.onIncomingOpsCallback = onIncomingOps;

    try {
      this.unwatchSpaceFsChanges = await this.fs.watch(
        this.spacePath,
        this.handleWatchEvent.bind(this),
        { recursive: true }
      );
    } catch (error) {
      console.error("Error setting up file watch:", error);
      throw error;
    }

    // Start periodic secret checking
    if (!this.saveSecretsTimer) {
      this.saveSecretsTimer = interval(() => this.checkIfSecretsNeedToBeSaved(), this.saveSecretsIntervalMs);
    }
  }

  async stopListening?(): Promise<void> {
    if (this.unwatchSpaceFsChanges) {
      this.unwatchSpaceFsChanges();
      this.unwatchSpaceFsChanges = null;
    }

    this.onIncomingOpsCallback = null;
  }

  private async ensureDirectoryStructure(): Promise<void> {
    // Create space directory if it doesn't exist
    await this.fs.mkdir(this.spacePath, { recursive: true });

    // Create versioned space directory
    const versionedPath = this.spacePath + '/space-v1';
    await this.fs.mkdir(versionedPath, { recursive: true });

    // Create ops directory
    await this.fs.mkdir(versionedPath + '/ops', { recursive: true });

    // Create files storage directories
    await this.fs.mkdir(versionedPath + '/files/static/sha256', { recursive: true });
    await this.fs.mkdir(versionedPath + '/files/var/uuid', { recursive: true });

    // Create sila.md file if it doesn't exist
    const readmeFile = this.spacePath + '/' + LOCAL_SPACE_MD_FILE;
    if (!await this.fs.exists(readmeFile)) {
      const file = await this.fs.create(readmeFile);
      await file.write(new TextEncoder().encode(TEXT_INSIDE_LOCAL_SPACE_MD_FILE));
      await file.close();
    }

    // Create space.json with the space ID if it doesn't exist
    const spaceJsonFile = versionedPath + '/space.json';
    if (!await this.fs.exists(spaceJsonFile)) {
      const file = await this.fs.create(spaceJsonFile);
      await file.write(new TextEncoder().encode(JSON.stringify({
        id: this.spaceId,
      })));
      await file.close();
    }
  }

  private getPathForTree(treeId: string): string {
    // Split the treeId into two parts to avoid having too many files in a single directory
    const prefix = treeId.substring(0, 2);
    const suffix = treeId.substring(2);
    return `${this.spacePath}/space-v1/ops/${prefix}/${suffix}`;
  }

  private makePathForOpsBasedOnDate(treeId: string, date: Date): string {
    // Use UTC date to ensure consistency across time zones
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${this.getPathForTree(treeId)}/${year}/${month}/${day}`;
  }

  private makePathForCurrentDayOps(treeId: string): string {
    // Create path based on current UTC date
    return this.makePathForOpsBasedOnDate(treeId, new Date());
  }

  private async openFileToCurrentTreeOpsJSONLFile(treeId: string, peerId: string): Promise<FileHandle> {
    const dirPath = this.makePathForCurrentDayOps(treeId);
    await this.fs.mkdir(dirPath, { recursive: true });

    const filePath = `${dirPath}/${peerId}.jsonl`;

    if (await this.fs.exists(filePath)) {
      return await this.fs.open(filePath, { append: true });
    }

    return await this.fs.create(filePath);
  }

  /**
   * Load all the operations for a given tree.
   * @param treeId - The ID of the tree to load operations for.
   * @returns An array of VertexOperation objects.
   * @throws An error if the file is not a valid JSONL file.
   */
  private async loadAllTreeOps(treeId: string): Promise<VertexOperation[]> {
    const treeOpsPath = this.getPathForTree(treeId);

    // Check if directory exists
    if (!await this.fs.exists(treeOpsPath)) {
      return [];
    }

    // Read all directories and get .jsonl files
    const dirEntries = await this.fs.readDir(treeOpsPath);
    const datePaths: string[] = [];
    const jsonlFiles: string[] = [];

    for (const entry of dirEntries) {
      // Check for year directories
      if (entry.isDirectory && entry.name.match(/^\d{4}$/)) {
        const yearPath = treeOpsPath + '/' + entry.name;
        const monthEntries = await this.fs.readDir(yearPath);

        for (const monthEntry of monthEntries) {
          if (monthEntry.isDirectory && monthEntry.name.match(/^\d{2}$/)) {
            const monthPath = yearPath + '/' + monthEntry.name;
            const dayEntries = await this.fs.readDir(monthPath);

            for (const dayEntry of dayEntries) {
              if (dayEntry.isDirectory && dayEntry.name.match(/^\d{2}$/)) {
                datePaths.push(monthPath + '/' + dayEntry.name);
              }
            }
          }
        }
      }
    }

    // Sort datePaths so we read files from older to newer
    datePaths.sort();

    for (const datePath of datePaths) {
      const jsonlFilesInDir = await this.fs.readDir(datePath);
      for (const file of jsonlFilesInDir) {
        if (file.isFile && file.name.endsWith('.jsonl')) {
          jsonlFiles.push(datePath + '/' + file.name);
        }
      }
    }

    const allOps: VertexOperation[] = [];
    for (const file of jsonlFiles) {
      try {
        const lines = await this.fs.readTextFileLines(file);
        const peerId = file.split('/').pop()!.split('.')[0];
        const ops = await this.turnJSONLinesIntoOps(lines, peerId);
        allOps.push(...ops);
      } catch (error) {
        console.error("Error reading ops from file", file, error);
        // Continue with other files
      }
    }

    return allOps;
  }

  private removeSavedOpsFromOpsToSave(treeId: string, ops: VertexOperation[]) {
    const opsToSave = this.treeOpsToSave.get(treeId);
    
    if (!opsToSave) {
      return;
    }

    // Filter out ops that are already saved
    const filteredOps = opsToSave.filter(op => !ops.some(o => equalsOpId(o.id, op.id)));
    this.treeOpsToSave.set(treeId, filteredOps);
  }

  private addOpsToSave(treeId: string, ops: ReadonlyArray<VertexOperation>) {
    let opsToSave = this.treeOpsToSave.get(treeId);
    if (!opsToSave) {
      opsToSave = [];
      this.treeOpsToSave.set(treeId, opsToSave);
    }

    // Exclude ops that are already in the opsToSave
    const newOps = ops.filter(op => !opsToSave.some(o => equalsOpId(o.id, op.id)));

    opsToSave.push(...newOps);

    // Start periodic save if not already running
    if (!this.saveOpsTimer) {
      this.saveOpsTimer = interval(() => this.saveOps(), this.saveOpsIntervalMs);
    }
  }

  private async saveOps() {
    if (this.savingOpsToFile) {
      return;
    }

    this.savingOpsToFile = true;

    for (const [treeId, ops] of this.treeOpsToSave.entries()) {
      if (ops.length === 0) {
        continue;
      }

      // Let's split ops by their peerId
      const opsByPeerId = new Map<string, VertexOperation[]>();
      for (const op of ops) {
        const peerId = op.id.peerId;
        let opsForPeerId = opsByPeerId.get(peerId);
        if (!opsForPeerId) {
          opsForPeerId = [];
          opsByPeerId.set(peerId, opsForPeerId);
        }
        opsForPeerId.push(op);
      }

      // Save ops for each peerId
      for (const [peerId, opsForPeerId] of opsByPeerId.entries()) {
        try {
          // Copy the ops to avoid modifying the original array while saving 
          // because saving is async.
          const ops = [...opsForPeerId];
          const opsJSONLines = this.turnOpsIntoJSONLines(ops);
          const opsFile = await this.openFileToCurrentTreeOpsJSONLFile(treeId, peerId);
          await opsFile.write(new TextEncoder().encode(opsJSONLines));
          await opsFile.close();
          
          // We remove precisely the ops that we just saved
          this.removeSavedOpsFromOpsToSave(treeId, ops);

          this.savedPeerIds.add(peerId);

        } catch (error) {
          console.error("Error saving ops to file", error);
        }
      }
    }

    this.savingOpsToFile = false;

    // Stop the timer if there are no pending ops
    if (!this.hasPendingOps() && this.saveOpsTimer) {
      this.saveOpsTimer();
      this.saveOpsTimer = null;
    }
  }

  private hasPendingOps(): boolean {
    for (const ops of this.treeOpsToSave.values()) {
      if (ops.length > 0) return true;
    }
    return false;
  }

  private turnOpsIntoJSONLines(ops: VertexOperation[]): string {
    let str = '';

    for (const op of ops) {
      if (isMoveVertexOp(op)) {
        // Save parentId with quotes because it might be null
        str += `["m",${op.id.counter},"${op.targetId}",${JSON.stringify(op.parentId)}]\n`;
      } else if (isAnyPropertyOp(op)) {
        // Convert undefined to empty object ({}) because JSON doesn't support undefined
        const value = op.value === undefined ? {} : op.value;
        str += `["p",${op.id.counter},"${op.targetId}","${op.key}",${JSON.stringify(value)}]\n`;
      }
    }

    return str;
  }

  private async turnJSONLinesIntoOps(lines: string[], peerId: string): Promise<VertexOperation[]> {
    return await this.opsParser.parseLines(lines, peerId);
  }

  // Secrets encryption/decryption (preserved from OLD_LocalSpaceSync.ts)
  private async encryptSecrets(secretsObj: Record<string, string>, key: string): Promise<string> {
    // Convert the key string to a crypto key
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // Convert secrets to string and encrypt
    const secretsString = JSON.stringify(secretsObj);
    const secretsBuffer = encoder.encode(secretsString);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      secretsBuffer
    );

    // Combine IV and encrypted data and convert to base64
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(combined).toString('base64');
    }
    return btoa(String.fromCharCode(...combined));
  }

  private async decryptSecrets(encryptedData: string, key: string): Promise<Record<string, string>> {
    // Convert the key string to a crypto key
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Convert base64 back to array buffer
    let combined: Uint8Array;
    if (typeof Buffer !== 'undefined') {
      combined = new Uint8Array(Buffer.from(encryptedData, 'base64'));
    } else {
      combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );
    }

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedBuffer = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encryptedBuffer
    );

    const decryptedString = new TextDecoder().decode(decryptedBuffer);
    try {
      return JSON.parse(decryptedString);
    } catch (error) {
      return {};
    }
  }

  private async readSecretsFromFile(): Promise<Record<string, string> | undefined> {
    const secretsPath = this.spacePath + '/space-v1/secrets';

    if (!await this.fs.exists(secretsPath)) {
      return undefined;
    }

    const encryptedData = await this.fs.readTextFile(secretsPath);
    if (!encryptedData) {
      return undefined;
    }

    return await this.decryptSecrets(encryptedData, this.spaceId);
  }

  private async writeSecretsToFile(secrets: Record<string, string>) {
    const encryptedData = await this.encryptSecrets(secrets, this.spaceId);
    const secretsPath = this.spacePath + '/space-v1/secrets';
    await this.fs.writeTextFile(secretsPath, encryptedData);
  }

  private async checkIfSecretsNeedToBeSaved() {
    // @TODO: Implement this
    // This method would need access to current secrets from the space
    // For now, we'll implement it when we integrate with SpaceManager
    // The old implementation compared current secrets with file secrets
  }

  // File watching event handler
  private handleWatchEvent(event: WatchEvent) {
    switch (event.event) {
      case 'add':
        if (event.path.endsWith('.jsonl')) {
          this.tryReadOpsFromPeer(event.path);
        } else if (event.path.endsWith('secrets')) {
          this.tryReadSecretsFromPeer(event.path);
        }
        break;
        
      case 'change':
        if (event.path.endsWith('.jsonl')) {
          this.tryReadOpsFromPeer(event.path);
        } else if (event.path.endsWith('secrets')) {
          this.tryReadSecretsFromPeer(event.path);
        }
        break;
        
      // We don't need to handle 'addDir', 'unlink', or 'unlinkDir' for our use case
      // but they're available if needed in the future
    }
  }

  private async tryReadOpsFromPeer(path: string) {
    if (!this.onIncomingOpsCallback) {
      return;
    }

    let peerId: string | null = null;
    let treeId: string | null = null;

    try {
      const splitPath = path.split('/');

      // Extract peer ID from the filename (remove .jsonl extension)
      peerId = splitPath.pop()!.split('.')[0];

      if (!peerId) {
        throw new Error("Peer ID not found in the path");
      }

      // Skip if we've saved ops for this peerId
      if (this.savedPeerIds.has(peerId)) {
        return;
      }

      // Extract tree ID from path structure
      const dayDir = splitPath.pop();
      if (!dayDir || !dayDir.match(/^\d{2}$/)) {
        throw new Error("Day directory not found in the path");
      }

      const monthDir = splitPath.pop();
      if (!monthDir || !monthDir.match(/^\d{2}$/)) {
        throw new Error("Month directory not found in the path");
      }

      const yearDir = splitPath.pop();
      if (!yearDir || !yearDir.match(/^\d{4}$/)) {
        throw new Error("Year directory not found in the path");
      }

      const treeIdEndPart = splitPath.pop();
      if (!treeIdEndPart) {
        throw new Error("Tree ID part 2 not found in the path");
      }

      const treeIdStartPart = splitPath.pop();
      if (!treeIdStartPart) {
        throw new Error("Tree ID part 1 not found in the path");
      }

      // Combine to get the full tree ID
      treeId = treeIdStartPart + treeIdEndPart;

    } catch (e) {
      console.error("Error getting peerId from", path);
      return;
    }

    const lines = await this.fs.readTextFileLines(path);
    const ops = await this.turnJSONLinesIntoOps(lines, peerId);

    if (ops.length === 0) {
      return;
    }

    // Notify callback about incoming operations
    this.onIncomingOpsCallback(treeId, ops);
  }

  private async tryReadSecretsFromPeer(path: string) {
    // For now, we don't handle incoming secrets from file watching
    // This could be implemented later if needed
  }
}

// TODO: Implement migration functions later
// export async function migrateSpaceIfNeeded(path: string): Promise<void> {
//   // Migration logic will be implemented later
// } 