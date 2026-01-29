import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import { uuid } from "@sila/core";

const port = Number(process.env.PORT) || 6001;

type User = {
  id: string;
};

type Space = {
  id: string;
  name: string;
};

const demoSpaces: Record<string, Space[]> = {
  "demo-token": [
    { id: "space-1", name: "Demo Space" },
    { id: "space-2", name: "Team Space" },
  ],
};

function getUserFromToken(authHeader: string | undefined): User | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  if (!token) return null;
  return { id: token };
}

function getSpacesForUser(user: User): Space[] {
  return demoSpaces[user.id] ?? [];
}

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ ok: true, id: uuid(), at: new Date().toISOString() });
});

app.get("/spaces", (c) => {
  const user = getUserFromToken(c.req.header("authorization"));
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  return c.json({ ok: true, spaces: getSpacesForUser(user) });
});

app.get("/spaces/:spaceId", (c) => {
  const user = getUserFromToken(c.req.header("authorization"));
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  const spaceId = c.req.param("spaceId");
  const space = getSpacesForUser(user).find((s) => s.id === spaceId);
  if (!space) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({ ok: true, space });
});

app.post("/spaces/:spaceId/connect", (c) => {
  const user = getUserFromToken(c.req.header("authorization"));
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  const spaceId = c.req.param("spaceId");
  const space = getSpacesForUser(user).find((s) => s.id === spaceId);
  if (!space) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({
    ok: true,
    connect: {
      namespace: `/spaces/${spaceId}`,
      path: "/socket.io",
    },
  });
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
  const user = getUserFromToken(`Bearer ${token}`);
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
