import type { MiddlewareHandler } from "hono";
import { getUserById, type User } from "../db";

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  if (!token) return null;
  return token;
}

export function createAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const token = extractBearerToken(c.req.header("authorization"));
    const user = token ? getUserById(token) : null;
    c.set("user", user ?? null);
    await next();
  };
}

export function getUserFromRequest(
  authHeader: string | undefined
): User | null {
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  return getUserById(token);
}
