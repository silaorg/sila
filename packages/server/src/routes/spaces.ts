import { Hono } from "hono";
import { addSpaceMember, createServerSpace, getSpacesForUserId } from "../db";
import type { AppVariables } from "../types";

const spaces = new Hono<{ Variables: AppVariables }>();

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

spaces.post("/spaces", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json({ ok: false, error: "name is required" }, 400);
  }

  const space = await createServerSpace({
    name,
    createdAt: new Date().toISOString(),
  });
  addSpaceMember(space.id, user.id, "owner");
  return c.json({ ok: true, space });
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

export default spaces;
