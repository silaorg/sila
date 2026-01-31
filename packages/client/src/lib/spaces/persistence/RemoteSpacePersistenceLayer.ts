import type { PersistenceLayer } from "@sila/core";
import type { VertexOperation } from "@sila/core";
import { StateVector } from "reptree";
import { io, type Socket } from "socket.io-client";
import { getTreeOps } from "@sila/client/localDb";

type StateVectorMap = Record<string, number[][]>;

type OpsSyncPayload = {
  treeId: string;
  ops: VertexOperation[];
};

type OpsSyncDonePayload = {
  treeIds: string[];
  stateVectors: Record<string, StateVectorMap | null>;
};

type OpsSendPayload = {
  treeId?: string;
  ops?: VertexOperation[];
};

export class RemoteSpacePersistenceLayer implements PersistenceLayer {
  readonly id: string;
  readonly type = "remote" as const;

  private _connected = false;
  private socket: Socket | null = null;
  private syncChain: Promise<void> = Promise.resolve();
  private cachedSyncOps = new Map<string, VertexOperation[]>();
  private onIncomingOps: ((treeId: string, ops: VertexOperation[]) => void) | null = null;
  private serverBaseUrl: string;

  constructor(
    private spaceUrl: string,
    private spaceId: string,
    private getAuthToken?: () => string | null,
  ) {
    this.id = `remote-${spaceUrl}::${spaceId}`;
    this.serverBaseUrl = this.resolveServerBaseUrl(spaceUrl, spaceId);
  }

  async connect(): Promise<void> {
    if (this._connected) return;

    const namespaceUrl = `${this.serverBaseUrl.replace(/\/+$/, "")}/spaces/${this.spaceId}`;
    const socket = io(namespaceUrl, {
      path: "/socket.io",
      autoConnect: false,
    });

    const token = this.getAuthToken?.() ?? null;
    if (token) {
      socket.auth = { token };
    }

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      };
      socket.once("connect", onConnect);
      socket.once("connect_error", onError);
      socket.connect();
    });

    this.socket = socket;
    this._connected = true;
  }

  isConnected(): boolean {
    return this._connected;
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return;
    this._connected = false;
    this.onIncomingOps = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    await this.connect();
    const { ops: localOps, stateVector } = await this.getLocalOpsAndVector(this.spaceId);
    const { opsByTree, stateVectors } = await this.requestSync({ [this.spaceId]: stateVector });
    const ops = opsByTree.get(this.spaceId) ?? [];
    this.cacheOtherTrees(this.spaceId, opsByTree);
    await this.sendMissingOpsToServer(this.spaceId, localOps, stateVectors[this.spaceId]);
    return ops;
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    await this.connect();
    const cached = this.cachedSyncOps.get(treeId);
    if (cached) {
      this.cachedSyncOps.delete(treeId);
      return cached;
    }

    const { ops: localOps, stateVector } = await this.getLocalOpsAndVector(treeId);
    const { opsByTree, stateVectors } = await this.requestSync({ [treeId]: stateVector });
    const ops = opsByTree.get(treeId) ?? [];
    this.cacheOtherTrees(treeId, opsByTree);
    await this.sendMissingOpsToServer(treeId, localOps, stateVectors[treeId]);
    return ops;
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    if (!this._connected || !this.socket) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }

    if (ops.length === 0) return;
    const opsToSend = this.filterOpsToSend(ops);
    if (opsToSend.length === 0) return;
    const payload: OpsSendPayload = { treeId, ops: opsToSend };
    this.socket.emit("ops:send", payload);
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    if (!this._connected) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }
    return undefined;
  }

  async saveSecrets(_secrets: Record<string, string>): Promise<void> {
    if (!this._connected) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }
  }

  async startListening(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void> {
    if (!this.socket) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }

    this.onIncomingOps = onIncomingOps;
    this.socket.on("ops:receive", (payload: OpsSendPayload) => {
      if (!payload?.treeId || !Array.isArray(payload.ops) || payload.ops.length === 0) {
        return;
      }
      this.onIncomingOps?.(payload.treeId, payload.ops);
    });

    for (const [treeId, ops] of this.cachedSyncOps.entries()) {
      if (ops.length > 0) {
        onIncomingOps(treeId, ops);
      }
    }
    this.cachedSyncOps.clear();
  }

  async stopListening(): Promise<void> {
    if (!this.socket) return;
    this.socket.removeAllListeners("ops:receive");
    this.onIncomingOps = null;
  }

  private cacheOtherTrees(requestedTreeId: string, opsByTree: Map<string, VertexOperation[]>) {
    for (const [treeId, ops] of opsByTree.entries()) {
      if (treeId === requestedTreeId) continue;
      if (ops.length === 0) continue;
      const existing = this.cachedSyncOps.get(treeId) ?? [];
      existing.push(...ops);
      this.cachedSyncOps.set(treeId, existing);
    }
  }

  private async requestSync(
    stateVectors: Record<string, StateVectorMap | null>,
  ): Promise<{ opsByTree: Map<string, VertexOperation[]>; stateVectors: Record<string, StateVectorMap | null> }> {
    const socket = this.socket;
    if (!socket) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }

    return await this.enqueueSync(() => new Promise((resolve, reject) => {
      const collected = new Map<string, VertexOperation[]>();
      let serverVectors: Record<string, StateVectorMap | null> = {};

      const onSync = (payload: OpsSyncPayload) => {
        if (!payload?.treeId || !Array.isArray(payload.ops)) return;
        const existing = collected.get(payload.treeId) ?? [];
        existing.push(...payload.ops);
        collected.set(payload.treeId, existing);
      };

      const onDone = (payload: OpsSyncDonePayload) => {
        cleanup();
        serverVectors = payload?.stateVectors ?? {};
        resolve({ opsByTree: collected, stateVectors: serverVectors });
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        socket.off("ops:sync", onSync);
        socket.off("ops:sync:done", onDone);
        socket.off("connect_error", onError);
      };

      socket.on("ops:sync", onSync);
      socket.once("ops:sync:done", onDone);
      socket.once("connect_error", onError);
      socket.emit("ops:state", { trees: stateVectors });
    }));
  }

  private enqueueSync<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.syncChain.then(fn, fn);
    this.syncChain = next.then(() => undefined, () => undefined);
    return next;
  }

  private async getLocalOpsAndVector(treeId: string): Promise<{ ops: VertexOperation[]; stateVector: StateVectorMap }> {
    const ops = await getTreeOps(this.spaceUrl, this.spaceId, treeId);
    const vector = StateVector.fromOperations(ops) as unknown as { getState?: () => StateVectorMap };
    const stateVector = vector.getState ? vector.getState() : {};
    return { ops, stateVector };
  }

  private async sendMissingOpsToServer(
    treeId: string,
    localOps: ReadonlyArray<VertexOperation>,
    serverStateVector?: StateVectorMap | null,
  ): Promise<void> {
    if (!this.socket || !serverStateVector) return;

    const serverVector = new StateVector(serverStateVector);
    const missingOps = localOps.filter((op) => !serverVector.contains(op.id));
    const opsToSend = this.filterOpsToSend(missingOps);
    if (opsToSend.length === 0) return;

    this.socket.emit("ops:send", { treeId, ops: opsToSend });
  }

  private filterOpsToSend(ops: ReadonlyArray<VertexOperation>): VertexOperation[] {
    return ops.length === 0 ? [] : [...ops];
  }

  private resolveServerBaseUrl(spaceUrl: string, spaceId: string): string {
    const normalized = spaceUrl.replace(/\/+$/, "");
    const suffix = `/spaces/${spaceId}`;
    if (normalized.endsWith(suffix)) {
      return normalized.slice(0, -suffix.length);
    }
    return normalized;
  }
}
