import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSocketServer } from "./socket";
import { initDb } from "./db";
import { createAuthMiddleware } from "./middleware/auth";
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
  io: ReturnType<typeof createSocketServer>;
  server: ReturnType<typeof serve>;
  port: number;
  close: () => Promise<void>;
};

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

  const io = createSocketServer({ server, jwtSecret });

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
