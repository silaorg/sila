import type { MiddlewareHandler } from "hono";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getUserById, type User } from "../db";

export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null;
  let token = authHeader.trim();
  if (!token) return null;
  const match = token.match(/^Bearer\s+(.+)$/i);
  if (!match || match.length != 2) return null;
  token = match[1]?.trim() ?? "";
  if (!token) return null;
  return token;
}

export function getUserIdFromToken(
  token: string,
  jwtSecret: string,
): string | null {
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string") return payload;
    const sub = (payload as JwtPayload).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export function getUserFromToken(
  token: string,
  jwtSecret: string,
): User | null {
  const userId = getUserIdFromToken(token, jwtSecret);
  if (!userId) return null;
  return getUserById(userId);
}

export function createAuthMiddleware(jwtSecret: string): MiddlewareHandler {
  return async (c, next) => {
    const token = extractBearerToken(c.req.header("authorization"));
    const user = token ? getUserFromToken(token, jwtSecret) : null;
    c.set("user", user ?? null);
    await next();
  };
}
