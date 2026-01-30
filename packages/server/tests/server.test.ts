import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import { io as createClient } from "socket.io-client";
import { Space } from "@sila/core";
import { getOrLoadServerSpace } from "../src/db";
import { startServer, type ServerInstance } from "../src/server";

const jsonHeaders = {
  "Content-Type": "application/json",
};

type CreatedUser = { id: string; email: string };

describe("server integration", () => {
  let server: ServerInstance;
  let baseUrl = "";
  let tempDir = "";
  let user: CreatedUser;
  let spaceId = "";
  let accessToken = "";

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-server-test-"));
    server = await startServer({
      port: 0,
      dbPath: path.join(tempDir, "server.sqlite"),
      jwtSecret: "test-secret",
      log: () => {},
    });
    baseUrl = `http://127.0.0.1:${server.port}`;

    const userResponse = await fetch(`${baseUrl}/dev-only/users`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: "test-user@example.com" }),
    });
    const userPayload = (await userResponse.json()) as { ok: boolean; user: CreatedUser };
    user = userPayload.user;
    accessToken = jwt.sign({ sub: user.id, email: user.email }, "test-secret", {
      expiresIn: "7d",
    });

    const spaceResponse = await fetch(`${baseUrl}/dev-only/spaces`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "Test Space", ownerId: user.id }),
    });
    const spacePayload = (await spaceResponse.json()) as {
      ok: boolean;
      space: { id: string };
    };
    spaceId = spacePayload.space.id;

    const space = await getOrLoadServerSpace(spaceId);
    space.tree.root?.setProperty("testKey", "testValue");
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("responds to health checks", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it("returns spaces for an authenticated user", async () => {
    const response = await fetch(`${baseUrl}/spaces`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = (await response.json()) as { ok: boolean; spaces: { id: string }[] };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.spaces.some((space) => space.id === spaceId)).toBe(true);
  });

  it("rejects spaces without auth", async () => {
    const response = await fetch(`${baseUrl}/spaces`);
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
  });

  it("creates a space", async () => {
    const createResponse = await fetch(`${baseUrl}/spaces`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Another Space" }),
    });
    const createPayload = (await createResponse.json()) as {
      ok: boolean;
      space?: { id: string };
    };

    expect(createResponse.status).toBe(200);
    expect(createPayload.ok).toBe(true);
    expect(createPayload.space?.id).toBeTruthy();
  });

  it("returns 400 on invalid space create payload", async () => {
    const response = await fetch(`${baseUrl}/spaces`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "" }),
    });
    const payload = (await response.json()) as { ok?: boolean; success?: boolean; error?: string };

    expect(response.status).toBe(400);
    expect(payload.ok === false || payload.success === false).toBe(true);
  });

  it("returns 404 for unknown space", async () => {
    const response = await fetch(`${baseUrl}/spaces/unknown-space`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
  });

  it("connects to spaces namespace over socket.io", async () => {
    const socket = createClient(`${baseUrl}/spaces/${spaceId}`, {
      path: "/socket.io",
      auth: { token: accessToken },
    });

    const readyPayload = await new Promise<{ spaceId: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("ready timeout"));
      }, 5000);

      socket.on("ready", (payload) => {
        clearTimeout(timeout);
        resolve(payload as { spaceId: string });
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(readyPayload.spaceId).toBe(spaceId);

    const syncPromise = new Promise<{ treeIds: string[] }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("sync timeout"));
      }, 5000);

      socket.once("ops:sync:done", (payload) => {
        clearTimeout(timeout);
        resolve(payload as { treeIds: string[] });
      });

      socket.once("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const opsPromise = new Promise<Map<string, unknown[]>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("ops timeout"));
      }, 5000);

      const opsByTree = new Map<string, unknown[]>();
      const onSync = (payload: { treeId: string; ops: unknown[] }) => {
        opsByTree.set(payload.treeId, payload.ops);
      };

      socket.on("ops:sync", onSync);
      socket.once("ops:sync:done", () => {
        clearTimeout(timeout);
        socket.off("ops:sync", onSync);
        resolve(opsByTree);
      });

      socket.once("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    socket.emit("ops:state", {});

    const syncPayload = await syncPromise;

    expect(Array.isArray(syncPayload.treeIds)).toBe(true);
    expect(syncPayload.treeIds.length).toBeGreaterThan(0);

    const opsPayload = await opsPromise;
    const spaceOps = opsPayload.get(spaceId);

    expect(spaceOps).toBeTruthy();
    expect(Array.isArray(spaceOps)).toBe(true);
    expect(spaceOps?.length).toBeGreaterThan(0);

    const reconstructed = Space.existingSpaceFromOps(spaceOps ?? []);
    expect(reconstructed.getId()).toBe(spaceId);

    socket.close();
  });

  it("rejects socket connections without auth", async () => {
    const socket = createClient(`${baseUrl}/spaces/${spaceId}`, {
      path: "/socket.io",
    });

    const error = await new Promise<Error>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("connect_error timeout"));
      }, 5000);

      socket.once("connect_error", (err) => {
        clearTimeout(timeout);
        resolve(err as Error);
      });
    });

    expect(error).toBeTruthy();

    socket.close();
  });
});
