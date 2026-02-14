import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSocketServer } from "./socket";
import { Database, type Space } from "./db";
import { createAuthMiddleware } from "./middleware/auth";
import { createAuthRouter } from "./routes/auth";
import { createDevOnlyRouter } from "./routes/devOnly";
import health from "./routes/health";
import { createSpacesRouter } from "./routes/spaces";
import type { AppVariables } from "./types";
import { Backend, FileSystemSyncLayer, SpaceManager, SyncLayer, uuid, Space as CoreSpace } from "@sila/core";
import { ServerSyncLayer } from "./sync/ServerSyncLayer";

import fs from "node:fs";
import path from "node:path";
import { NodeFileSystem } from "./utils/nodeFileSystem";

export type ServerStartOptions = {
  port?: number;
  dbPath?: string;
  jwtSecret?: string;
  log?: (message: string) => void;
};

const serverFs = new NodeFileSystem();

function getServerSpaceLayerSync(dataDir: string, spaceId: string): SyncLayer[] {
  const spacePath = path.join(dataDir, "spaces", spaceId);
  const fileSyncLayer = new FileSystemSyncLayer(spacePath, spaceId, serverFs);
  const serverSyncLayer = new ServerSyncLayer();

  return [fileSyncLayer, serverSyncLayer];
}

function ensureDbPath(dbPath: string): void {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
}

export class SilaServer {
  public app: Hono<{ Variables: AppVariables }>;
  public io: ReturnType<typeof createSocketServer> | undefined;
  public server: ReturnType<typeof serve> | undefined;
  public db: Database;
  public spaceManager: SpaceManager;
  public port: number;
  private log: (message: string) => void;
  private jwtSecret: string;

  constructor(options: ServerStartOptions = {}) {
    this.port = options.port ?? 6001;
    const dbPath = options.dbPath ?? "data/server.sqlite";
    this.jwtSecret = options.jwtSecret ?? "dev-secret-change-me";
    this.log = options.log ?? ((message: string) => console.log(message));

    ensureDbPath(dbPath);
    const dataDir = path.dirname(dbPath);

    this.db = new Database(dbPath);

    const spaceBackends = new Map<string, Backend>();
    this.spaceManager = new SpaceManager({
      setupSyncLayers: (spaceUri) => getServerSpaceLayerSync(dataDir, spaceUri),
      setupSpaceHandler: (spaceUri, space) => {
        if (!spaceBackends.has(spaceUri)) {
          spaceBackends.set(spaceUri, new Backend(space));
        }
      },
    });

    this.app = new Hono<{ Variables: AppVariables }>();
  }

  async start() {
    this.app.use("*", cors({ origin: "*" }));
    this.app.use("*", createAuthMiddleware(this.jwtSecret, this.db));

    this.app.route("/", health);
    this.app.route("/", createAuthRouter(this.jwtSecret, this.db));
    this.app.route("/", createSpacesRouter(this.db, this.spaceManager));
    this.app.route("/dev-only", createDevOnlyRouter(this.jwtSecret, this.db, this.spaceManager));

    this.server = serve({
      fetch: this.app.fetch,
      port: this.port,
    });

    this.io = createSocketServer({
      server: this.server,
      jwtSecret: this.jwtSecret,
      spaceManager: this.spaceManager,
      db: this.db,
    });

    await new Promise<void>((resolve) => {
      if (this.server?.listening) {
        resolve();
        return;
      }
      this.server?.on("listening", () => resolve());
    });

    const address = this.server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : this.port;
    this.port = resolvedPort;

    this.log(`[server] listening on http://localhost:${resolvedPort}`);
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      if (!this.io) {
        resolve();
        return;
      }
      this.io.close(() => {
        if (!this.server?.listening) {
          resolve();
          return;
        }
        this.server.close((err) => {
          const error = err as NodeJS.ErrnoException | null;
          if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
            reject(error);
            return;
          }
          this.db.close();
          resolve();
        });
      });
    });
  }
}

export async function startServer(options: ServerStartOptions = {}): Promise<SilaServer> {
  const server = new SilaServer(options);
  await server.start();
  return server;
}

export async function createServerSpace(
  spaceManager: SpaceManager,
  db: Database,
  input: {
    name: string;
    createdAt: string;
  }
): Promise<Space> {
  const space = CoreSpace.newSpace(uuid());
  space.name = input.name;
  const created = db.createSpace({
    id: space.getId(),
    name: input.name,
    createdAt: input.createdAt,
  });
  await spaceManager.addSpace(space, created.id);
  return created;
}
