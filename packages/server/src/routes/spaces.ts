import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Database } from "../db";
import { createServerSpace } from "../server";
import type { AppVariables } from "../types";
import { SpaceManager } from "@sila/core";

export function createSpacesRouter(db: Database, spaceManager: SpaceManager): Hono<{ Variables: AppVariables }> {
  const spaces = new Hono<{ Variables: AppVariables }>();

  const createSpaceSchema = z.object({
    name: z.string().trim().min(1).max(80).optional(),
  });

  spaces.get("/spaces", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
    const spaces = db.getSpacesForUserId(user.id);
    if (spaces.length === 0) {
      const space = await createServerSpace(spaceManager, db, {
        name: "My First Space",
        createdAt: new Date().toISOString(),
      });
      db.addSpaceMember(space.id, user.id, "owner");
      return c.json({ ok: true, spaces: [space] });
    }

    return c.json({ ok: true, spaces });
  });

  spaces.get("/spaces/:spaceId", (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
    const spaceId = c.req.param("spaceId");
    const space = db.getSpacesForUserId(user.id).find((s) => s.id === spaceId);
    if (!space) return c.json({ ok: false, error: "not found" }, 404);
    return c.json({ ok: true, space });
  });

  spaces.post("/spaces", zValidator("json", createSpaceSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);

    const body = c.req.valid("json");
    const name = body.name ?? "New space";

    const space = await createServerSpace(spaceManager, db, {
      name,
      createdAt: new Date().toISOString(),
    });
    db.addSpaceMember(space.id, user.id, "owner");
    return c.json({ ok: true, space });
  });

  spaces.delete("/spaces/:spaceId", (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
    const spaceId = c.req.param("spaceId");

    console.log(`User ${user.id} requested deletion of space ${spaceId}`);

    throw new Error("Not implemented");
  });

  spaces.post("/spaces/:spaceId/connect", (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
    const spaceId = c.req.param("spaceId");
    const space = db.getSpacesForUserId(user.id).find((s) => s.id === spaceId);
    if (!space) return c.json({ ok: false, error: "not found" }, 404);
    return c.json({
      ok: true,
      connect: {
        namespace: `/spaces/${spaceId}`,
        path: "/socket.io",
      },
    });
  });

  return spaces;
}
