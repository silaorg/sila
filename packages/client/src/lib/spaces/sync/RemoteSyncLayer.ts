import type { SyncLayer, VertexOperation } from "@sila/core";
import { io, Socket } from "socket.io-client";

type OpsSendPayload = {
  treeId: string;
  ops: VertexOperation[];
};

type OpsReceivePayload = {
  treeId: string;
  ops: VertexOperation[];
};

export class RemoteSyncLayer implements SyncLayer {
  readonly id: string;
  readonly type = "remote" as const;

  private socket: Socket | null = null;
  private pendingTreeRequests = new Map<string, { resolve: (ops: VertexOperation[]) => void; reject: (err: Error) => void }>();
  private loadedTrees = new Set<string>();
  private onIncomingOps?: (treeId: string, ops: VertexOperation[]) => void;
  private connected = false;

  constructor(
    private readonly spaceUri: string, // URL to connect to, e.g. http://localhost:6001/spaces/space-id
    private readonly getAuthToken?: () => string | null,
  ) {
    this.id = `remote-sync-${spaceUri}`;
  }

  async getSpaceId(): Promise<string | undefined> {
    // Extract spaceId from URI: .../spaces/SPACE_ID
    const match = this.spaceUri.match(/\/spaces\/([^\/]+)$/);
    return match ? match[1] : undefined;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = this.getAuthToken?.();

    this.socket = io(this.spaceUri, {
      path: "/socket.io",
      auth: { token },
      autoConnect: false,
      reconnection: true,
    });

    this.socket.on("connect", () => {
      console.log(`[RemoteSyncLayer] Connected to ${this.spaceUri}`);
      this.connected = true;
    });

    this.socket.on("disconnect", () => {
      console.log(`[RemoteSyncLayer] Disconnected from ${this.spaceUri}`);
      this.connected = false;
    });

    this.socket.on("ops:sync", (payload: OpsReceivePayload) => {
      // Initial sync or re-sync
      console.log(`[RemoteSyncLayer] Received ops:sync for tree ${payload.treeId}, ops: ${payload.ops.length}`);

      this.loadedTrees.add(payload.treeId);

      // Resolve any pending requests for this tree
      const pending = this.pendingTreeRequests.get(payload.treeId);
      if (pending) {
        pending.resolve(payload.ops);
        this.pendingTreeRequests.delete(payload.treeId);
      } else {
        // If no one is waiting, just notify the listener
        this.onIncomingOps?.(payload.treeId, payload.ops);
      }
    });

    this.socket.on("ops:receive", (payload: OpsReceivePayload) => {
      // Real-time ops
      // console.log(`[RemoteSyncLayer] Received ops:receive for tree ${payload.treeId}, ops: ${payload.ops.length}`);
      this.onIncomingOps?.(payload.treeId, payload.ops);
    });

    this.socket.connect();
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    // For remote layer, we determine the spaceId from the URI
    const spaceId = await this.getSpaceId();
    if (!spaceId) return [];
    return this.loadTreeOps(spaceId);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    // If we already loaded this tree (via ops:sync), we might want to return nothing 
    // because onIncomingOps handled it? 
    // BUT SpaceRunner calls loadTreeOps explicitly.
    // Ideally, we should wait for the ops:sync event.

    if (this.loadedTrees.has(treeId)) {
      // If already loaded, we assume subsequent updates come via ops:receive/ops:sync events 
      // that are handled by startListening callback.
      // However, if SpaceRunner asks for it, it might be looking for initial state.
      // Since we don't store ops here, we can't return them if we missed the event 
      // or if it was already consumed. 
      // But for the initial load, this promise should be pending until ops:sync arrives.
      return [];
    }

    return new Promise<VertexOperation[]>((resolve, reject) => {
      // Set a timeout
      const timeout = setTimeout(() => {
        if (this.pendingTreeRequests.has(treeId)) {
          this.pendingTreeRequests.delete(treeId);
          // Don't reject, just return empty so SpaceRunner can continue (maybe other layers have data)
          // But for RemoteLayer, empty means no data.
          console.warn(`[RemoteSyncLayer] Timeout waiting for tree ${treeId}`);
          resolve([]);
        }
      }, 5000);

      this.pendingTreeRequests.set(treeId, {
        resolve: (ops) => {
          clearTimeout(timeout);
          resolve(ops);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  async saveTreeOps(
    treeId: string,
    ops: ReadonlyArray<VertexOperation>,
  ): Promise<void> {
    if (!this.socket || !this.connected) {
      // internal queueing handled by socket.io usually, but good to check
    }

    // Create a mutable copy if needed, or just pass as is (socket.io serializes it)
    const payload: OpsSendPayload = {
      treeId,
      ops: ops as VertexOperation[],
    };

    this.socket?.emit("ops:send", payload);
  }

  async startListening(
    onIncomingOps: (treeId: string, ops: VertexOperation[]) => void,
  ): Promise<void> {
    this.onIncomingOps = onIncomingOps;
  }
}
