import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import { getUserById, initDb } from "./db";
import { createAuthMiddleware } from "./middleware/auth";
import { createDevOnlyRouter } from "./routes/devOnly";
import health from "./routes/health";
import spaces from "./routes/spaces";
import type { AppVariables } from "./types";

const port = Number(process.env.PORT) || 6001;

const dbPath = process.env.DB_PATH || "data/server.sqlite";
initDb(dbPath);
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

const app = new Hono<{ Variables: AppVariables }>();
app.use("*", createAuthMiddleware());

app.route("/", health);
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
  const user = getUserById(token);
  if (!user) {
    next(new Error("unauthorized"));
    return;
  }
  (socket as any).user = user;
  next();
});

spacesNamespace.on("connection", (socket) => {
  const namespace = socket.nsp.name;
  const spaceId = namespace.split("/").pop() || "unknown";
  socket.join(spaceId);

  socket.emit("ready", { spaceId });

  socket.on("ops:send", (payload) => {
    socket.to(spaceId).emit("ops:receive", payload);
  });

  socket.on("disconnect", () => {
    socket.leave(spaceId);
  });
});

console.log(`[server] listening on http://localhost:${port}`);
