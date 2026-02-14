import { Server, type DefaultEventsMap, type Socket } from "socket.io";
import type { ServerType } from "@hono/node-server";
import { type VertexOperation, SpaceManager } from "@sila/core";
import type { Database } from "./db";
import { getUserFromToken } from "./middleware/auth";

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

  const ensureServerOpsBroadcast = async (spaceId: string) => {
    if (observedSpaces.has(spaceId)) {
      return;
    }

    const space = await spaceManager.loadSpace(spaceId);
    const observed = { appTrees: new Set<string>() };
    observedSpaces.set(spaceId, observed);

    // Forward local ops to all clients in the space room.
    const emitOps = (treeId: string, ops: VertexOperation[]) => {
      if (ops.length === 0) return;
      spacesNamespace.to(spaceId).emit("ops:receive", { treeId, ops });
    };

    space.tree.observeOpApplied((op: VertexOperation) => {
      if (op.id.peerId !== space.tree.peerId) return;
      emitOps(space.getId(), [op]);
    });

    // Attach listeners for each app tree once.
    const registerAppTree = async (appTreeId: string) => {
      if (observed.appTrees.has(appTreeId)) return;
      observed.appTrees.add(appTreeId);

      const appTree = space.getAppTree(appTreeId) ?? await space.loadAppTree(appTreeId);
      if (!appTree) return;

      appTree.tree.observeOpApplied((op: VertexOperation) => {
        if (op.id.peerId !== appTree.tree.peerId) return;
        emitOps(appTreeId, [op]);
      });
    };

    for (const appTree of space.getLoadedAppTrees()) {
      void registerAppTree(appTree.getId());
    }

    space.onNewAppTree((appTreeId: string) => {
      void registerAppTree(appTreeId);
    });

    space.onTreeLoad((appTreeId: string) => {
      void registerAppTree(appTreeId);
    });
  };

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

    // Ensure we are listening to space updates to broadcast to the room
    await ensureServerOpsBroadcast(spaceId);

    console.log(`Socket connected: ${socket.id} to space ${spaceId}`);

    const space = await spaceManager.loadSpace(spaceId);
    socket.emit("ready", { spaceId });

    // @TODO: introduce the socket to ServerSyncLayer
  });

  return io;
}
