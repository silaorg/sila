import { Server, type DefaultEventsMap, type Socket } from "socket.io";
import type { ServerType } from "@hono/node-server";
import { type VertexOperation, SpaceManager } from "@sila/core";
import type { Database } from "./db";
import { getUserFromToken } from "./middleware/auth";
import { ServerSyncLayer } from "./sync/ServerSyncLayer";

export type SocketServerOptions = {
  server: ServerType;
  jwtSecret: string;
  spaceManager: SpaceManager;
  db: Database;
};

type SocketData = {
  userId: string;
  spaceId: string;
};

type SpaceSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

function getSpaceIdFromNamespace(namespace: string): string | null {
  const parts = namespace.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "spaces") {
    return null;
  }
  return parts[1] || null;
}

export function createSocketServer({ server, jwtSecret, spaceManager, db }: SocketServerOptions): Server {
  const io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: true,
    },
  });

  const spacesNamespace = io.of(/^\/spaces\/.+$/);
  const observedSpaces = new Map<string, { appTrees: Set<string> }>();

  // Auth + space access gate for namespace connections.
  const authenticateSocket = (socket: SpaceSocket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      next(new Error("unauthorized"));
      return;
    }

    const user = getUserFromToken(token, jwtSecret, db);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }

    const spaceId = getSpaceIdFromNamespace(socket.nsp.name);
    if (!spaceId) {
      next(new Error("invalid namespace"));
      return;
    }

    const hasAccess = db.getSpacesForUserId(user.id).some((space) => space.id === spaceId);
    if (!hasAccess) {
      next(new Error("forbidden"));
      return;
    }

    socket.data.userId = user.id;
    socket.data.spaceId = spaceId;
    next();
  };

  spacesNamespace.use(authenticateSocket);

  spacesNamespace.on("connection", async (socket: SpaceSocket) => {
    const { spaceId } = socket.data;
    socket.join(spaceId);

    const space = await spaceManager.loadSpace(spaceId);
    socket.emit("ready", { spaceId });

    // Send initial state to the connecting socket
    // Send initial state to the connecting socket
    const emitOps = (treeId: string, ops: VertexOperation[]) => {
      socket.emit("ops:sync", {
        treeId,
        ops,
      });
      socket.emit("ops:sync:done", { treeIds: [treeId] });
    };

    // Delay sync to ensure client listeners are ready
    setTimeout(() => {
      // Sync root tree
      emitOps(space.getId(), space.tree.getAllOps() as VertexOperation[]);

      // Sync loaded app trees
      for (const appTree of space.getLoadedAppTrees()) {
        emitOps(appTree.getId(), appTree.tree.getAllOps() as VertexOperation[]);
      }
    }, 50);

    // @TODO: introduce the socket to ServerSyncLayer
    const syncLayers = spaceManager.getSyncLayers(spaceId);
    if (syncLayers) {
      const serverSyncLayer = syncLayers.find(l => l instanceof ServerSyncLayer) as ServerSyncLayer | undefined;
      serverSyncLayer?.addSocket(socket);
    }
  });

  return io;
}
