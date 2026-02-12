import { Server, type DefaultEventsMap, type Socket } from "socket.io";
import type { ServerType } from "@hono/node-server";
import type { VertexOperation } from "reptree";
import {
  getOrLoadServerSpace,
  getServerSpaceLayer,
  getSpacesForUserId,
} from "./db";
import { getUserFromToken } from "./middleware/auth";

export type SocketServerOptions = {
  server: ServerType;
  jwtSecret: string;
};

type SocketData = {
  userId: string;
  spaceId: string;
};

type SpaceSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

type OpsStatePayload = {
  trees?: Record<string, Record<string, number[][]> | null>;
};

type OpsSendPayload = {
  treeId?: string;
  ops?: VertexOperation[];
};

function getSpaceIdFromNamespace(namespace: string): string | null {
  const parts = namespace.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "spaces") {
    return null;
  }
  return parts[1] || null;
}

function getAppTreeIds(space: { appTreesVertex: { children: { getProperty: (key: string) => unknown }[] } }): string[] {
  return space.appTreesVertex.children
    .map((vertex) => vertex.getProperty("tid"))
    .filter((tid): tid is string => typeof tid === "string");
}

async function getTreeOpsDiff(
  spaceId: string,
  treeId: string,
  theirStateVector?: Record<string, number[][]> | null,
): Promise<VertexOperation[]> {
  const space = await getOrLoadServerSpace(spaceId);

  if (treeId === space.getId()) {
    space.tree.stateVectorEnabled = true;
    return theirStateVector
      ? space.tree.getMissingOps(theirStateVector)
      : space.tree.getAllOps() as VertexOperation[];
  }

  const appTree = await space.loadAppTree(treeId);
  if (!appTree) {
    return [];
  }

  appTree.tree.stateVectorEnabled = true;
  return theirStateVector
    ? appTree.tree.getMissingOps(theirStateVector)
    : appTree.tree.getAllOps() as VertexOperation[];
}

export function createSocketServer({ server, jwtSecret }: SocketServerOptions): Server {
  const io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: true,
    },
  });

  // Namespace per space: /spaces/:spaceId
  const spacesNamespace = io.of(/^\/spaces\/.+$/);
  const observedSpaces = new Map<string, { appTrees: Set<string> }>();

  const ensureServerOpsBroadcast = async (spaceId: string) => {
    if (observedSpaces.has(spaceId)) {
      return;
    }

    const space = await getOrLoadServerSpace(spaceId);
    const observed = { appTrees: new Set<string>() };
    observedSpaces.set(spaceId, observed);

    // Forward local ops to all clients in the space room.
    const emitOps = (treeId: string, ops: VertexOperation[]) => {
      if (ops.length === 0) return;
      spacesNamespace.to(spaceId).emit("ops:receive", { treeId, ops });
    };

    space.tree.observeOpApplied((op) => {
      if (op.id.peerId !== space.tree.peerId) return;
      emitOps(space.getId(), [op]);
    });

    // Attach listeners for each app tree once.
    const registerAppTree = async (appTreeId: string) => {
      if (observed.appTrees.has(appTreeId)) return;
      observed.appTrees.add(appTreeId);

      const appTree = space.getAppTree(appTreeId) ?? await space.loadAppTree(appTreeId);
      if (!appTree) return;

      appTree.tree.observeOpApplied((op) => {
        if (op.id.peerId !== appTree.tree.peerId) return;
        emitOps(appTreeId, [op]);
      });
    };

    for (const appTree of space.getLoadedAppTrees()) {
      void registerAppTree(appTree.getId());
    }

    space.onNewAppTree((appTreeId) => {
      void registerAppTree(appTreeId);
    });

    space.onTreeLoad((appTreeId) => {
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

    const user = getUserFromToken(token, jwtSecret);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }

    const spaceId = getSpaceIdFromNamespace(socket.nsp.name);
    if (!spaceId) {
      next(new Error("invalid namespace"));
      return;
    }

    const hasAccess = getSpacesForUserId(user.id).some((space) => space.id === spaceId);
    if (!hasAccess) {
      next(new Error("forbidden"));
      return;
    }

    socket.data.userId = user.id;
    socket.data.spaceId = spaceId;
    next();
  };

  spacesNamespace.use(authenticateSocket);

  // Send missing ops for the requested trees based on state vectors.
  const handleOpsState = async (socket: SpaceSocket, payload: OpsStatePayload) => {
    const { spaceId } = socket.data;
    const provided = payload?.trees ?? {};
    const requestedTreeIds = Object.keys(provided);

    for (const treeId of requestedTreeIds) {
      // If provided[treeId] is explicitly null, it means fetching ALL ops (no local state)
      // If it is a vector, it means fetching missing ops.
      const ops = await getTreeOpsDiff(spaceId, treeId, provided[treeId]);

      if (ops.length > 0) {
        socket.emit("ops:sync", { treeId, ops });
      }
    }

    socket.emit("ops:sync:done", { treeIds: requestedTreeIds });
  };

  // Persist and merge incoming ops, then broadcast to other clients.
  const handleOpsSend = async (socket: SpaceSocket, payload: OpsSendPayload) => {
    const { spaceId } = socket.data;
    const treeId = payload?.treeId;
    const ops = payload?.ops;
    if (!treeId || !Array.isArray(ops) || ops.length === 0) {
      return;
    }

    // @TODO: Validate ops before saving/merging

    const layer = await getServerSpaceLayer(spaceId);
    await layer.saveTreeOps(treeId, ops);

    const space = await getOrLoadServerSpace(spaceId);
    if (treeId === space.getId()) {
      space.tree.merge(ops);
    } else {
      const appTree = await space.loadAppTree(treeId);
      if (appTree) {
        appTree.tree.merge(ops);
      }
    }

    socket.to(spaceId).emit("ops:receive", payload);
  };

  spacesNamespace.on("connection", (socket: SpaceSocket) => {
    const { spaceId } = socket.data;
    socket.join(spaceId);
    ensureServerOpsBroadcast(spaceId);

    console.log(`Socket connected: ${socket.id} to space ${spaceId}`);

    // Initial handshake for space sockets.
    socket.emit("ready", { spaceId });

    socket.on("ops:state", async (payload: OpsStatePayload) => {
      await handleOpsState(socket, payload);
    });

    socket.on("ops:send", async (payload: OpsSendPayload) => {
      await handleOpsSend(socket, payload);
    });

    socket.on("disconnect", () => {
      socket.leave(spaceId);
    });
  });

  return io;
}
