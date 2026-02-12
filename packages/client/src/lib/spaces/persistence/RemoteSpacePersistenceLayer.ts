import { ConnectedPersistenceLayer } from "@sila/core";
import type { Space, SpaceRunner, VertexOperation } from "@sila/core";
import { isAnyPropertyOp } from "@sila/core";
import { StateVector } from "reptree";
import { io, type Socket } from "socket.io-client";

type OpsSyncPayload = {
  treeId: string;
  ops: VertexOperation[];
};

type OpsSendPayload = {
  treeId?: string;
  ops?: VertexOperation[];
};

export class RemoteSpacePersistenceLayer extends ConnectedPersistenceLayer {
  readonly id: string;
  readonly type = "remote" as const;

  private socket: Socket | null = null;
  private syncChain: Promise<void> = Promise.resolve();
  private cachedSyncOps = new Map<string, VertexOperation[]>();
  private onIncomingOps: ((treeId: string, ops: VertexOperation[]) => void) | null = null;
  private serverBaseUrl: string;
  private spaceRunner: SpaceRunner | null = null;

  constructor(
    private spaceUrl: string,
    private getAuthToken?: () => string | null,
  ) {
    super();
    this.id = spaceUrl;
    this.serverBaseUrl = spaceUrl;
  }

  protected async doConnect(): Promise<void> {
    const namespaceUrl = this.id;
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
  }

  protected async doDisconnect(): Promise<void> {
    this.onIncomingOps = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  referenceSpaceRunner(spaceRunner: SpaceRunner): void {
    this.spaceRunner = spaceRunner;
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    await this.connect();

    let spaceTreeVector: Record<string, number[][]> | null = null;

    const space = this.spaceRunner?.getSpace();
    if (space) {
      spaceTreeVector = space.tree.getStateVector();
    }

    // Get space tree ops from the server
    // If we have a vector, we send it to get missing ops
    // If we don't (null), we send null to get ALL ops
    const spaceIdFromUrl = this.id.split("/").pop()!;

    const vectorMap = { [spaceIdFromUrl]: spaceTreeVector };
    const resultMap = await this.requestSync(vectorMap);

    return resultMap.get(spaceIdFromUrl) || [];
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    await this.connect();

    // check if we have the tree to get its vector
    let treeVector: Record<string, number[][]> | null = null;
    const space = this.spaceRunner?.getSpace();
    if (space) {
      const appTree = space.getAppTree(treeId);
      if (appTree) {
        treeVector = appTree.tree.getStateVector();
      }
    }

    const vectorMap = { [treeId]: treeVector };
    const resultMap = await this.requestSync(vectorMap);
    return resultMap.get(treeId) || [];
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    if (!this.isConnected() || !this.socket) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }

    // @TODO: send vector state to the server

    if (ops.length === 0) return;
    const opsToSend = ops.filter((op) => !isAnyPropertyOp(op) || !op.transient);
    if (opsToSend.length === 0) return;

    const payload: OpsSendPayload = {
      treeId,
      ops: opsToSend,
    };
    this.socket.emit("ops:send", payload);
  }

  async loadSecrets(): Promise<Record<string, string> | undefined> {
    if (!this.isConnected()) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }
    return undefined;
  }

  async saveSecrets(_secrets: Record<string, string>): Promise<void> {
    if (!this.isConnected()) {
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

  private async requestSync(stateVectors: Record<string, Record<string, number[][]> | null>): Promise<Map<string, VertexOperation[]>> {
    const socket = this.socket;
    if (!socket) {
      throw new Error("RemoteSpacePersistenceLayer not connected");
    }

    return await this.enqueueSync(() => new Promise<Map<string, VertexOperation[]>>((resolve, reject) => {
      const collected = new Map<string, VertexOperation[]>();

      const onSync = (payload: OpsSyncPayload) => {
        if (!payload?.treeId || !Array.isArray(payload.ops)) return;
        const existing = collected.get(payload.treeId) ?? [];
        existing.push(...payload.ops);
        collected.set(payload.treeId, existing);
      };

      const onDone = () => {
        cleanup();
        resolve(collected);
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
}
