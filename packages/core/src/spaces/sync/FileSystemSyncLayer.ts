import type { VertexOperation } from "reptree";
import type { SyncLayer } from "./SyncLayer";
import type { AppFileSystem, FileHandle, WatchEvent, UnwatchFn } from "@sila/core";
import { isMoveVertexOp, isAnyPropertyOp } from "@sila/core";
import { interval } from "@sila/core";
import { OpsParser } from "../persistence/OpsParser";
import { equalsOpId } from "reptree";

export const LOCAL_SPACE_MD_FILE = 'sila.md';
export const TEXT_INSIDE_LOCAL_SPACE_MD_FILE = `# Sila Space

This directory contains a Sila space. Please do not rename or modify the 'space-v1' folder as you won't be able to open the space from Sila. Sila needs it as is.`;

type OpsFileType = 'm' | 'p';

/**
 * File system sync layer that saves operations to local files in JSONL format.
 */
export class FileSystemSyncLayer implements SyncLayer {
  readonly id: string;
  readonly type = 'local' as const;

  private connected = false;
  private saveOpsTimer: (() => void) | null = null;
  private savingOpsToFile = false;
  private treeOpsToSave = new Map<string, VertexOperation[]>();
  private saveOpsIntervalMs = 500;
  private opsParser: OpsParser;
  private secretsWriteChain: Promise<void> = Promise.resolve();
  private unwatchSpaceFsChanges: UnwatchFn | null = null;
  private onIncomingOpsCallback: ((treeId: string, ops: VertexOperation[]) => void) | null = null;
  private savedPeerIds = new Set<string>();

  constructor(
    private spacePath: string,
    private spaceId: string,
    private fs: AppFileSystem
  ) {
    this.id = `filesystem-sync-${spaceId}`;
    this.opsParser = new OpsParser();
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    await this.ensureDirectoryStructure();
    this.connected = true;
  }

  async dispose(): Promise<void> {
    if (this.saveOpsTimer) {
      this.saveOpsTimer();
      this.saveOpsTimer = null;
    }

    // Ensure any pending ops are flushed before teardown
    await this.saveOps();
    await this.secretsWriteChain;

    // Clean up the ops parser
    this.opsParser.destroy();
    this.connected = false;
  }

  async getSpaceId(): Promise<string | undefined> {
    await this.ensureConnected();

    // Use the same logic for finding space.json
    const spaceJsonPath = this.spacePath + '/space-v1/space.json';
    if (await this.fs.exists(spaceJsonPath)) {
      const spaceJsonContent = await this.fs.readTextFile(spaceJsonPath);
      const spaceJson = JSON.parse(spaceJsonContent);
      return spaceJson.id;
    }

    // If no space.json exists yet, this is a new space
    return undefined;
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    await this.ensureConnected();

    // Read the space.json to get the actual space ID (tree ID)
    const spaceJsonPath = this.spacePath + '/space-v1/space.json';
    if (await this.fs.exists(spaceJsonPath)) {
      const spaceJsonContent = await this.fs.readTextFile(spaceJsonPath);
      const spaceJson = JSON.parse(spaceJsonContent);
      return await this.loadAllTreeOps(spaceJson.id);
    }

    // If no space.json exists yet, return empty array (new space)
    return [];
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    await this.ensureConnected();
    return await this.loadAllTreeOps(treeId);
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    await this.ensureConnected();

    if (ops.length === 0) return;

    // Filter out transient properties and add to save queue
    const opsToSave = ops.filter(op => !isAnyPropertyOp(op) || !op.transient);
    if (opsToSave.length === 0) return;

    // Update space.json with the actual space ID when we save the space tree
    await this.ensureSpaceJsonExists(treeId);



    this.addOpsToSave(treeId, opsToSave);
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
  }

  async stopListening?(): Promise<void> {
    if (this.unwatchSpaceFsChanges) {
      this.unwatchSpaceFsChanges();
      this.unwatchSpaceFsChanges = null;
    }

    this.onIncomingOpsCallback = null;
  }

  // File watching event handler
  private handleWatchEvent(event: WatchEvent) {
    if (event.event === 'change' || event.event === 'add') {
      if (event.path.endsWith('.jsonl')) {
        this.tryReadOpsFromPeer(event.path);
      }
    }
  }

  private async tryReadOpsFromPeer(path: string) {
    if (!this.onIncomingOpsCallback) {
      return;
    }


    let peerId: string | null = null;
    let opType: OpsFileType | undefined;
    let treeId: string | null = null;

    try {
      const splitPath = path.split('/');

      // Extract peer ID from the filename (remove .jsonl extension)
      const fileName = splitPath.pop()!;
      const fileInfo = this.getOpsFileInfo(fileName);
      if (!fileInfo) {
        // Not an ops file we care about
        return;
      }

      peerId = fileInfo.peerId;
      opType = fileInfo.opType;

      if (!peerId) {
        return;
      }

      // Skip if we've saved ops for this peerId (it's us)
      if (this.savedPeerIds.has(peerId)) {
        return;
      }

      // Extract tree ID from path structure
      const dayDir = splitPath.pop();
      if (!dayDir || !dayDir.match(/^\d{2}$/)) return;

      const monthDir = splitPath.pop();
      if (!monthDir || !monthDir.match(/^\d{2}$/)) return;

      const yearDir = splitPath.pop();
      if (!yearDir || !yearDir.match(/^\d{4}$/)) return;

      const treeIdEndPart = splitPath.pop();
      if (!treeIdEndPart) return;

      const treeIdStartPart = splitPath.pop();
      if (!treeIdStartPart) return;

      // Combine to get the full tree ID
      treeId = treeIdStartPart + treeIdEndPart;

    } catch (e) {
      console.error("Error getting peerId from", path);
      return;
    }

    try {
      const lines = await this.fs.readTextFileLines(path);
      const ops = await this.turnJSONLinesIntoOps(lines, peerId, opType);

      if (ops.length === 0) {
        return;
      }

      // Notify callback about incoming operations
      this.onIncomingOpsCallback(treeId, ops);
    } catch (error) {
      console.error("Error reading ops from peer file", path, error);
    }
  }

  private async ensureSpaceJsonExists(spaceId: string): Promise<void> {
    const spaceJsonFile = this.spacePath + '/space-v1/space.json';
    if (!await this.fs.exists(spaceJsonFile)) {
      const file = await this.fs.create(spaceJsonFile);
      await file.write(new TextEncoder().encode(JSON.stringify({
        id: spaceId,
      })));
      await file.close();
    }
  }

  private async ensureDirectoryStructure(): Promise<void> {
    // Create space directory if it doesn't exist
    await this.fs.mkdir(this.spacePath, { recursive: true });

    // Create versioned space directory
    const versionedPath = this.spacePath + '/space-v1';
    await this.fs.mkdir(versionedPath, { recursive: true });

    // Create ops directory
    await this.fs.mkdir(versionedPath + '/ops', { recursive: true });

    // Create sila.md file if it doesn't exist
    const readmeFile = this.spacePath + '/' + LOCAL_SPACE_MD_FILE;
    if (!await this.fs.exists(readmeFile)) {
      const file = await this.fs.create(readmeFile);
      await file.write(new TextEncoder().encode(TEXT_INSIDE_LOCAL_SPACE_MD_FILE));
      await file.close();
    }

    // Note: space.json will be created/updated when we first save tree ops
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

  private async openFileToCurrentTreeOpsJSONLFile(
    treeId: string,
    peerId: string,
    opType: OpsFileType
  ): Promise<FileHandle> {
    const dirPath = this.makePathForCurrentDayOps(treeId);
    await this.fs.mkdir(dirPath, { recursive: true });

    const filePath = this.makeOpsFilePath(dirPath, peerId, opType);

    if (await this.fs.exists(filePath)) {
      return await this.fs.open(filePath, { append: true });
    }

    return await this.fs.create(filePath);
  }

  private makeOpsFilePath(dirPath: string, peerId: string, opType: OpsFileType): string {
    return `${dirPath}/${peerId}-${opType}.jsonl`;
  }

  private getOpsFileInfo(fileName: string): { peerId: string; opType?: OpsFileType } | null {
    if (!fileName.endsWith('.jsonl')) {
      return null;
    }

    const match = fileName.match(/^(.*)-(m|p)\.jsonl$/);
    if (match) {
      return { peerId: match[1], opType: match[2] as OpsFileType };
    }

    const peerId = fileName.split('.')[0];
    return peerId ? { peerId } : null;
  }

  /**
   * Load all the operations for a given tree.
   * @param treeId - The ID of the tree to load operations for.
   * @returns An array of VertexOperation objects.
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

    const jsonlFiles: string[] = [];
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
        const fileName = file.split('/').pop()!;
        const fileInfo = this.getOpsFileInfo(fileName);
        if (!fileInfo) {
          continue;
        }
        const ops = await this.turnJSONLinesIntoOps(lines, fileInfo.peerId, fileInfo.opType);
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
          const opsToSave = [...opsForPeerId];
          const moveOps = opsToSave.filter(isMoveVertexOp);
          const propertyOps = opsToSave.filter(isAnyPropertyOp);

          if (moveOps.length > 0) {
            const opsJSONLines = this.turnMoveOpsIntoJSONLines(moveOps);
            const opsFile = await this.openFileToCurrentTreeOpsJSONLFile(treeId, peerId, 'm');
            await opsFile.write(new TextEncoder().encode(opsJSONLines));
            await opsFile.close();
            this.removeSavedOpsFromOpsToSave(treeId, moveOps);
          }

          if (propertyOps.length > 0) {
            const opsJSONLines = this.turnPropertyOpsIntoJSONLines(propertyOps);
            const opsFile = await this.openFileToCurrentTreeOpsJSONLFile(treeId, peerId, 'p');
            await opsFile.write(new TextEncoder().encode(opsJSONLines));
            await opsFile.close();
            this.removeSavedOpsFromOpsToSave(treeId, propertyOps);
          }
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

  private turnMoveOpsIntoJSONLines(ops: VertexOperation[]): string {
    let str = '';

    for (const op of ops) {
      if (isMoveVertexOp(op)) {
        // Save parentId with quotes because it might be null
        str += `[${op.id.counter},"${op.targetId}",${JSON.stringify(op.parentId)}]\n`;
      }
    }

    return str;
  }

  private turnPropertyOpsIntoJSONLines(ops: VertexOperation[]): string {
    let str = '';

    for (const op of ops) {
      if (isAnyPropertyOp(op)) {
        // Convert undefined to empty object ({}) because JSON doesn't support undefined
        const value = op.value === undefined ? {} : op.value;
        str += `[${op.id.counter},"${op.targetId}","${op.key}",${JSON.stringify(value)}]\n`;
      }
    }

    return str;
  }

  private async turnJSONLinesIntoOps(
    lines: string[],
    peerId: string,
    opTypeHint?: OpsFileType
  ): Promise<VertexOperation[]> {
    return await this.opsParser.parseLines(lines, peerId, opTypeHint);
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    await this.ensureConnected();
    return await this.readSecretsFromFile();
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    await this.ensureConnected();

    if (Object.keys(secrets).length === 0) return;

    // Serialize writes to avoid last-writer-wins race conditions
    this.secretsWriteChain = this.secretsWriteChain.then(async () => {
      const existing = await this.readSecretsFromFile();
      const merged = { ...(existing || {}), ...secrets };
      await this.writeSecretsToFile(merged);
    });

    await this.secretsWriteChain;
  }

  // Secrets encryption/decryption
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
}
