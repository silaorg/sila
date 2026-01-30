import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Server } from "socket.io";
import type { VertexOperation } from "reptree";
import {
  getOrLoadServerSpace,
  getServerSpaceLayer,
  getSpacesForUserId,
  initDb,
} from "./db";
import { createAuthMiddleware, getUserFromToken } from "./middleware/auth";
import { createAuthRouter } from "./routes/auth";
import { createDevOnlyRouter } from "./routes/devOnly";
import health from "./routes/health";
import spaces from "./routes/spaces";
import type { AppVariables } from "./types";

export type ServerStartOptions = {
  port?: number;
  dbPath?: string;
  jwtSecret?: string;
  log?: (message: string) => void;
};

export type ServerInstance = {
  app: Hono<{ Variables: AppVariables }>;
  io: Server;
  server: ReturnType<typeof serve>;
  port: number;
  close: () => Promise<void>;
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

export async function startServer(options: ServerStartOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? 6001;
  const dbPath = options.dbPath ?? "data/server.sqlite";
  const jwtSecret = options.jwtSecret ?? "dev-secret-change-me";
  const log = options.log ?? ((message: string) => console.log(message));

  initDb(dbPath);

  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", cors({ origin: "*" }));
  app.use("*", createAuthMiddleware(jwtSecret));

  app.route("/", health);
  app.route("/", createAuthRouter(jwtSecret));
  app.route("/", spaces);
  app.route("/dev-only", createDevOnlyRouter(jwtSecret));

  const server = serve({
    fetch: app.fetch,
    port,
  });

  const io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: true,
    },
  });

  const spacesNamespace = io.of(/^\/spaces\/.+$/);

  spacesNamespace.use((socket, next) => {
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

    (socket as any).user = user;
    (socket as any).spaceId = spaceId;
    next();
  });

  spacesNamespace.on("connection", (socket) => {
    const spaceId = (socket as any).spaceId || "unknown";
    socket.join(spaceId);

    socket.emit("ready", { spaceId });

    socket.on("ops:state", async (payload: { trees?: Record<string, Record<string, number[][]> | null> }) => {
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
    });

    socket.on("ops:send", async (payload: { treeId?: string; ops?: VertexOperation[] }) => {
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
    });

    socket.on("disconnect", () => {
      socket.leave(spaceId);
    });
  });

  await new Promise<void>((resolve) => {
    if (server.listening) {
      resolve();
      return;
    }
    server.on("listening", () => resolve());
  });

  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  log(`[server] listening on http://localhost:${resolvedPort}`);

  return {
    app,
    io,
    server,
    port: resolvedPort,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        io.close(() => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close((err) => {
            const error = err as NodeJS.ErrnoException | null;
            if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
              reject(error);
              return;
            }
            resolve();
          });
        });
      });
    },
  };
}
