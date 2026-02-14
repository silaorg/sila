import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as createClient } from "socket.io-client";
import { RepTree } from "reptree";
import { startServer, type SilaServer } from "../src/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";

const jsonHeaders = {
  "Content-Type": "application/json",
};

describe("sync integration", () => {
  let server: SilaServer;
  let baseUrl = "";
  let tempDir = "";
  let user: { id: string; email: string };
  let accessToken = "";
  let spaceId = "";

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-sync-test-"));
    const port = 0; // Random free port
    const jwtSecret = "test-secret";

    // dataDir is derived from dbPath in startServer
    server = await startServer({
      port,
      dbPath: path.join(tempDir, "server.sqlite"),
      jwtSecret,
    });

    baseUrl = `http://localhost:${server.port}`;

    // Create a user
    const authRes = await fetch(`${baseUrl}/dev-only/users`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: "test@example.com" }),
    });

    // Check if authRes is ok
    if (!authRes.ok) {
      throw new Error(`Failed to create user: ${authRes.status} ${await authRes.text()}`);
    }

    const authData = await authRes.json() as { ok: boolean, user: { id: string, email: string } };
    user = authData.user;

    // Generate token manually as dev-only might not return it for creation or we want to be explicit
    accessToken = jwt.sign({ sub: user.id, email: user.email }, jwtSecret, {
      expiresIn: "7d",
    });

    // Create a space
    const spaceRes = await fetch(`${baseUrl}/dev-only/spaces`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "Sync Test Space", ownerId: user.id }),
    });

    if (!spaceRes.ok) {
      throw new Error(`Failed to create space: ${spaceRes.status} ${await spaceRes.text()}`);
    }

    const spaceData = await spaceRes.json() as { ok: boolean, space: { id: string } };
    spaceId = spaceData.space.id;
  });

  afterAll(async () => {
    if (server) await server.close();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("broadcasts ops between clients", async () => {
    // Client A
    const socket1 = createClient(`${baseUrl}/spaces/${spaceId}`, {
      path: "/socket.io",
      auth: { token: accessToken },
      autoConnect: false,
      reconnection: false,
    });

    // Client B
    const socket2 = createClient(`${baseUrl}/spaces/${spaceId}`, {
      path: "/socket.io",
      auth: { token: accessToken },
      autoConnect: false,
      reconnection: false,
    });

    // Connect both
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socket1.on("connect", resolve);
        socket1.on("connect_error", (err) => reject(new Error(`Socket1 connect error: ${err.message}`)));
        socket1.connect();
      }),
      new Promise<void>((resolve, reject) => {
        socket2.on("connect", resolve);
        socket2.on("connect_error", (err) => reject(new Error(`Socket2 connect error: ${err.message}`)));
        socket2.connect();
      }),
    ]);

    // Wait for initial sync on socket1 to get valid base state
    const { ops: initialOps } = await new Promise<{ treeId: string; ops: any[] }>((resolve) => {
      socket1.once("ops:sync", resolve);
    });

    // Initialize client-side RepTree to generate a valid op
    const clientTree = new RepTree("peerA", initialOps);
    if (!clientTree.root) {
      throw new Error("Client tree root not found after initial sync");
    }

    // Perform an operation: set a property on the root
    clientTree.root.setProperty("syncTest", "working");

    // Get the generated operation
    const history = clientTree.getAllOps();
    const op = history[history.length - 1];

    // Setup listener on socket2
    const receivePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for ops:receive")), 5000);
      socket2.on("ops:receive", (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    // Send op from socket1
    socket1.emit("ops:send", {
      treeId: spaceId,
      ops: [op],
    });

    // Verify socket2 receives it
    const received = await receivePromise;
    expect(received.treeId).toBe(spaceId);
    expect(received.ops).toHaveLength(1);
    expect(received.ops[0].id).toEqual(op.id);
    expect(received.ops[0].value).toBe("working");

    socket1.close();
    socket2.close();
  });
});
