import { Hono } from "hono";
import jwt from "jsonwebtoken";
import { uuid } from "@sila/core";
import type { AppVariables } from "../types";
import {
  addSpaceMember,
  createSpace,
  createUser,
  getUserById,
  listSpaceMembers,
  listSpaces,
  listUsers,
} from "../db";

function issueUserToken(userId: string, email: string, secret: string): string {
  return jwt.sign({ sub: userId, email }, secret, { expiresIn: "7d" });
}

export function createDevOnlyRouter(jwtSecret: string): Hono<{ Variables: AppVariables }> {
  const devOnly = new Hono<{ Variables: AppVariables }>();

  devOnly.get("/users", (c) => {
    return c.json({ ok: true, users: listUsers() });
  });

  devOnly.post("/users", async (c) => {
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

    const user = createUser({ id: uuid(), email, createdAt: new Date().toISOString() });
    return c.json({ ok: true, user });
  });

  devOnly.get("/users/:userId", (c) => {
    const userId = c.req.param("userId");
    const user = getUserById(userId);
    if (!user) return c.json({ ok: false, error: "not found" }, 404);
    const token = issueUserToken(user.id, user.email, jwtSecret);
    return c.json({ ok: true, user, token });
  });

  devOnly.get("/spaces", (c) => {
    return c.json({ ok: true, spaces: listSpaces() });
  });

  devOnly.post("/spaces", async (c) => {
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

    const space = createSpace({ id: uuid(), name, createdAt: new Date().toISOString() });
    addSpaceMember(space.id, ownerId, "owner");
    return c.json({ ok: true, space });
  });

  devOnly.get("/space-members/:spaceId", (c) => {
    const spaceId = c.req.param("spaceId");
    return c.json({ ok: true, members: listSpaceMembers(spaceId) });
  });

  devOnly.post("/space-members/:spaceId", async (c) => {
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

  return devOnly;
}
