import { Hono } from "hono";
import { getSpacesForUserId } from "../db";
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
