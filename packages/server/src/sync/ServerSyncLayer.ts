import { SyncLayer } from "@sila/core";
import { VertexOperation } from "reptree";
import type { Socket } from "socket.io";

export class ServerSyncLayer implements SyncLayer {
  readonly id = "server-sync-layer";
  readonly type = "remote";
  readonly isBroadcasting = true;

  private sockets = new Set<Socket>();
  private peerToSocket = new Map<string, Socket>();
  private onIncomingOps?: (treeId: string, ops: VertexOperation[]) => void;

  constructor() { }

  async loadSpaceTreeOps(): Promise<VertexOperation[]> {
    return [];
  }

  async loadTreeOps(_treeId: string): Promise<VertexOperation[]> {
    return [];
  }

  async saveTreeOps(treeId: string, ops: ReadonlyArray<VertexOperation>): Promise<void> {
    if (this.sockets.size === 0) return;

    for (const socket of this.sockets) {
      const opsToSend: VertexOperation[] = [];
      for (const op of ops) {
        // If we know the sender socket, we skip it.
        const senderSocket = this.peerToSocket.get(op.id.peerId);
        // If we found a sender socket, and it is THIS socket, skip.
        if (senderSocket && senderSocket.id === socket.id) {
          continue;
        }
        opsToSend.push(op);
      }

      if (opsToSend.length > 0) {
        socket.emit("ops:receive", { treeId, ops: opsToSend });
      }
    }
  }

  async startListening(onIncomingOps: (treeId: string, ops: VertexOperation[]) => void): Promise<void> {
    this.onIncomingOps = onIncomingOps;
  }

  addSocket(socket: Socket) {
    this.sockets.add(socket);

    socket.on("ops:send", (payload: { treeId: string; ops: VertexOperation[] }) => {
      if (!payload || !payload.ops || payload.ops.length === 0) {
        return;
      }

      // Register peerId mapping
      const peerId = payload.ops[0].id.peerId;
      if (peerId) {
        this.peerToSocket.set(peerId, socket);
      }

      this.onIncomingOps?.(payload.treeId, payload.ops);
    });

    socket.on("disconnect", () => {
      this.sockets.delete(socket);
      for (const [peerId, s] of this.peerToSocket.entries()) {
        if (s === socket) {
          this.peerToSocket.delete(peerId);
        }
      }
    });
  }
}
