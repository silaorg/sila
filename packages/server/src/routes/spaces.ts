import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { addSpaceMember, createServerSpace, getSpacesForUserId, getOrLoadServerSpace } from "../db";
import type { VertexOperation } from "reptree";
import type { AppVariables } from "../types";

const spaces = new Hono<{ Variables: AppVariables }>();

const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

spaces.get("/spaces", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  return c.json({ ok: true, spaces: getSpacesForUserId(user.id) });
});

spaces.get("/spaces/:spaceId", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  const spaceId = c.req.param("spaceId");
  const space = getSpacesForUserId(user.id).find((s) => s.id === spaceId);
  if (!space) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({ ok: true, space });
});

spaces.post("/spaces", zValidator("json", createSpaceSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);

  const body = c.req.valid("json");
  const name = body.name ?? "New space";

  const space = await createServerSpace({
    name,
    createdAt: new Date().toISOString(),
  });
  addSpaceMember(space.id, user.id, "owner");
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


spaces.get("/spaces/:spaceId/:treeId", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
  const spaceId = c.req.param("spaceId");
  const treeId = c.req.param("treeId");

  // Check access
  const hasAccess = getSpacesForUserId(user.id).some((s) => s.id === spaceId);
  if (!hasAccess) return c.json({ ok: false, error: "not found" }, 404);

  try {
    const space = await getOrLoadServerSpace(spaceId);
    let ops: VertexOperation[] = [];

    if (treeId === spaceId) {
      ops = space.tree.getAllOps() as VertexOperation[];
    } else {
      const appTree = await space.loadAppTree(treeId);
      if (appTree) {
        ops = appTree.tree.getAllOps() as VertexOperation[];
      }
    }

    return c.json(ops);
  } catch (e) {
    console.error(`Failed to fetch ops for space ${spaceId} tree ${treeId}`, e);
    return c.json({ ok: false, error: "internal error" }, 500);
  }
});

export default spaces;
