import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { uuid } from "@sila/core";
import {
  addSpaceMember,
  createSpace,
  createUser,
  getSpacesForUserId,
  getUserById,
  initDb,
  listUsers,
  listSpaces,
  listSpaceMembers,
  type User,
} from "./db";

const port = Number(process.env.PORT) || 6001;

const dbPath = process.env.DB_PATH || "data/server.sqlite";
initDb(dbPath);
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  if (!token) return null;
  return token;
}

function issueUserToken(user: User): string {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, {
    expiresIn: "7d",
  });
}

type AppVariables = {
  user: User | null;
};

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", async (c, next) => {
  const token = extractBearerToken(c.req.header("authorization"));
  const user = token ? getUserById(token) : null;
  c.set("user", user ?? null);
  await next();
});

app.get("/health", (c) => {
  return c.json({ ok: true, id: uuid(), at: new Date().toISOString() });
});

app.get("/spaces", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  return c.json({ ok: true, spaces: getSpacesForUserId(user.id) });
});

app.get("/spaces/:spaceId", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  const spaceId = c.req.param("spaceId");
  const space = getSpacesForUserId(user.id).find((s) => s.id === spaceId);
  if (!space) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({ ok: true, space });
});

app.post("/spaces/:spaceId/connect", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  const spaceId = c.req.param("spaceId");
  const space = getSpacesForUserId(user.id).find((s) => s.id === spaceId);
  if (!space) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({
    ok: true,
    connect: {
      namespace: `/spaces/${spaceId}`,
      path: "/socket.io",
    },
  });
});

app.get("/dev-only/users", (c) => {
  return c.json({ ok: true, users: listUsers() });
});

app.post("/dev-only/users", async (c) => {
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const email = body.email?.trim();
  if (!email) {
    return c.json({ ok: false, error: "email is required" }, 400);
  }

  const user = createUser({ id: uuid(), email });
  return c.json({ ok: true, user });
});

app.get("/dev-only/users/:userId", (c) => {
  const userId = c.req.param("userId");
  const user = getUserById(userId);
  if (!user) return c.json({ ok: false, error: "not found" }, 404);
  const token = issueUserToken(user);
  return c.json({ ok: true, user, token });
});

app.get("/dev-only/spaces", (c) => {
  return c.json({ ok: true, spaces: listSpaces() });
});

app.post("/dev-only/spaces", async (c) => {
  let body: { name?: string; ownerId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const name = body.name?.trim();
  const ownerId = body.ownerId?.trim();
  if (!name || !ownerId) {
    return c.json({ ok: false, error: "name and ownerId are required" }, 400);
  }

  const owner = getUserById(ownerId);
  if (!owner) return c.json({ ok: false, error: "owner not found" }, 404);

  const space = createSpace({ id: uuid(), name });
  addSpaceMember(space.id, ownerId, "owner");
  return c.json({ ok: true, space });
});

app.get("/dev-only/space-members/:spaceId", (c) => {
  const spaceId = c.req.param("spaceId");
  return c.json({ ok: true, members: listSpaceMembers(spaceId) });
});

app.post("/dev-only/space-members/:spaceId", async (c) => {
  const spaceId = c.req.param("spaceId");
  let body: { userId?: string; role?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const userId = body.userId?.trim();
  const role = body.role?.trim() || "member";
  if (!userId) {
    return c.json({ ok: false, error: "userId is required" }, 400);
  }

  const user = getUserById(userId);
  if (!user) return c.json({ ok: false, error: "user not found" }, 404);

  addSpaceMember(spaceId, userId, role);
  return c.json({ ok: true, spaceId, userId, role });
});

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
