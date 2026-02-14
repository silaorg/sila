import type { SyncLayer, VertexOperation } from "@sila/core";
import { type RepTree } from "@sila/core";
import { io, Socket } from "socket.io-client";

/**
 * Remote sync layer using socket.io.
 */
export class RemoteSyncLayer implements SyncLayer {
  readonly id: string;
  readonly type = "remote" as const;

  private socket: Socket | undefined;

  constructor(
    private readonly spaceUri: string,
    private readonly spaceId: string,
    private readonly getAuthToken?: () => string | null,
  ) {
    this.id = `remote-sync-${spaceUri}`;
  }

  getSpaceId(): Promise<string | undefined> {
    return Promise.resolve(this.spaceId);
  }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return this.loadTreeOps(this.spaceId);
  }

  async loadTreeOps(treeId: string): Promise<VertexOperation[]> {
    try {
      const token = this.getAuthToken?.();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // spaceUri is http://localhost:6001/spaces/SPACE_ID
      // we want http://localhost:6001/spaces/SPACE_ID/TREE_ID
      const url = `${this.spaceUri}/${treeId}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (response.status === 404) return [];
        console.error(`Failed to fetch ops for ${treeId}: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Error loading tree ops from remote:", e);
      return [];
    }
  }

  async saveTreeOps(
    treeId: string,
    ops: ReadonlyArray<VertexOperation>,
  ): Promise<void> {
    if (!this.socket?.connected) return;
    this.socket.emit("ops:send", { treeId, ops });
  }

  private pendingSecrets: Record<string, string> = {};

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    if (!this.socket?.connected) {
      this.pendingSecrets = { ...this.pendingSecrets, ...secrets };
      return;
    }
    this.socket.emit("secrets:send", secrets);
  }

  async startListening(
    onIncomingOps: (treeId: string, ops: VertexOperation[]) => void,
  ): Promise<void> {
    if (this.socket) return;

    const token = this.getAuthToken?.();
    const url = new URL(this.spaceUri);
    const origin = url.origin;

    this.socket = io(`${origin}/spaces/${this.spaceId}`, {
      auth: { token },
      path: "/socket.io",
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log(`[RemoteSync] Connected to ${this.spaceId}`);
      if (Object.keys(this.pendingSecrets).length > 0) {
        this.socket?.emit("secrets:send", this.pendingSecrets);
        this.pendingSecrets = {};
      }
    });

    this.socket.on("disconnect", () => {
      console.log(`[RemoteSync] Disconnected from ${this.spaceId}`);
    });

    this.socket.on("ops:receive", (payload: { treeId: string; ops: VertexOperation[] }) => {
      if (payload?.treeId && payload?.ops) {
        onIncomingOps(payload.treeId, payload.ops);
      }
    });

    this.socket.on("ops:sync", (payload: { treeId: string; ops: VertexOperation[] }) => {
      if (payload?.treeId && payload?.ops) {
        onIncomingOps(payload.treeId, payload.ops);
      }
    });
  }

  async uploadMissingFromTree(tree: RepTree): Promise<void> {
    if (!this.socket?.connected || !tree.root) return;

    const stateVector = tree.getStateVector();
    this.socket.emit("ops:state", {
      trees: {
        [tree.root.id]: stateVector ?? null,
      },
    });
  }
}
