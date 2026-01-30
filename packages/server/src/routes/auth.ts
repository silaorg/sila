import { Hono } from "hono";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getUserById } from "../db";
import type { AppVariables } from "../types";

function issueUserToken(userId: string, email: string, secret: string): string {
  return jwt.sign({ sub: userId, email }, secret, { expiresIn: "7d" });
}

export function createAuthRouter(jwtSecret: string): Hono<{ Variables: AppVariables }> {
  const auth = new Hono<{ Variables: AppVariables }>();

  auth.post("/auth/refresh", async (c) => {
    let body: { refresh_token?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid json" }, 400);
    }

    const refreshToken = body.refresh_token?.trim();
    if (!refreshToken) {
      return c.json({ ok: false, error: "refresh_token is required" }, 400);
    }

    let payload: JwtPayload;
    try {
      const decoded = jwt.verify(refreshToken, jwtSecret);
      if (typeof decoded === "string") {
        return c.json({ ok: false, error: "invalid token" }, 401);
      }
      payload = decoded as JwtPayload;
    } catch {
      return c.json({ ok: false, error: "invalid token" }, 401);
    }

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) {
      return c.json({ ok: false, error: "invalid token" }, 401);
    }

    const user = getUserById(userId);
    if (!user) {
      return c.json({ ok: false, error: "user not found" }, 404);
    }

    const accessToken = issueUserToken(user.id, user.email, jwtSecret);

    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 7 * 24 * 60 * 60,
    });
  });

  auth.get("/auth/me", (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthorized" }, 401);
    return c.json(user);
  });

  return auth;
}
