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
  private onIncomingOps?: (treeId: string, ops: VertexOperation[]) => void;
  private connected = false;

  constructor(
    private readonly spaceUri: string, // URL to connect to, e.g. http://localhost:6001/spaces/space-id
    private readonly getAuthToken?: () => string | null,
  ) {
    this.id = `remote-sync-${spaceUri}`;
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
      this.onIncomingOps?.(payload.treeId, payload.ops);
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
    return []; // We rely on ops:sync event for initial load
  }

  async loadTreeOps(_treeId: string): Promise<VertexOperation[]> {
    return []; // We rely on ops:sync event for initial load
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
