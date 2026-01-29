import { Hono } from "hono";
import { uuid } from "@sila/core";
import type { AppVariables } from "../types";

const health = new Hono<{ Variables: AppVariables }>();

health.get("/health", (c) => {
  return c.json({ ok: true, id: uuid(), at: new Date().toISOString() });
});

export default health;
