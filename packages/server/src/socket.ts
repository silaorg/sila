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

  const spacesNamespace = io.of(/^\/spaces\/.+$/);
  const observedSpaces = new Map<string, { appTrees: Set<string> }>();

  const ensureServerOpsBroadcast = async (spaceId: string) => {
    if (observedSpaces.has(spaceId)) {
      return;
    }

    const space = await getOrLoadServerSpace(spaceId);
    const observed = { appTrees: new Set<string>() };
    observedSpaces.set(spaceId, observed);

    const emitOps = (treeId: string, ops: VertexOperation[]) => {
      if (ops.length === 0) return;
      spacesNamespace.to(spaceId).emit("ops:receive", { treeId, ops });
    };

    space.tree.observeOpApplied((op) => {
      if (op.id.peerId !== space.tree.peerId) return;
      emitOps(space.getId(), [op]);
    });

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

    space.observeNewAppTree((appTreeId) => {
      void registerAppTree(appTreeId);
    });

    space.observeTreeLoad((appTreeId) => {
      void registerAppTree(appTreeId);
    });
  };

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

  const handleOpsState = async (socket: SpaceSocket, payload: OpsStatePayload) => {
    const { spaceId } = socket.data;
    const space = await getOrLoadServerSpace(spaceId);
    const treeIds = [space.getId(), ...getAppTreeIds(space)];
    const provided = payload?.trees ?? {};

    for (const treeId of treeIds) {
      const ops = await getTreeOpsDiff(spaceId, treeId, provided[treeId] ?? null);
      if (ops.length > 0) {
        socket.emit("ops:sync", { treeId, ops });
      }
    }

    socket.emit("ops:sync:done", { treeIds });
  };

  const handleOpsSend = async (socket: SpaceSocket, payload: OpsSendPayload) => {
    const { spaceId } = socket.data;
    const treeId = payload?.treeId;
    const ops = payload?.ops;
    if (!treeId || !Array.isArray(ops) || ops.length === 0) {
      return;
    }

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
    void ensureServerOpsBroadcast(spaceId);

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
