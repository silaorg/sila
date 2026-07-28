import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LangMessage } from "aiwrapper";
import {
  AppWorkspaceError,
  AppWorkspaceService,
} from "../src/app-workspace-service.js";
import { ThreadStore } from "../src/agent-runtime/thread-store.js";

test("AppWorkspaceService scopes API threads to a user and emits changes", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-"));
  const store = new ThreadStore();
  const changes = [];
  const service = new AppWorkspaceService({
    workspacePath,
    onChange(change) {
      changes.push(change);
    },
    async createAgentRuntime() {
      return {
        async handleThreadMessage(input) {
          await store.appendMessages(input.threadDir, [
            new LangMessage("user", [{
              type: "text",
              text: `<@${input.userId}>: ${input.text}`,
            }]),
            new LangMessage("assistant", [{ type: "text", text: "Hello from Heswe" }]),
          ]);
          return { responded: true, answer: "Hello from Heswe" };
        },
      };
    },
  });

  const created = await service.createThread("user-a", { title: "First chat" });
  assert.equal(created.title, "First chat");
  assert.equal((await service.listThreads("user-a")).length, 1);
  assert.equal((await service.listThreads("user-b")).length, 0);

  const result = await service.sendMessage("user-a", created.id, "Hello");
  assert.equal(result.answer, "Hello from Heswe");

  const thread = await service.getThread("user-a", created.id);
  assert.deepEqual(thread.messages.map((message) => message.text), [
    "Hello",
    "Hello from Heswe",
  ]);
  assert.equal("events" in thread, false);
  assert.deepEqual(Object.keys(thread.messages[0]).sort(), ["at", "id", "role", "text"]);
  assert.deepEqual(changes.map((change) => change.type), [
    "thread.created",
    "thread.changed",
  ]);

  await assert.rejects(
    service.getThread("user-b", created.id),
    /Thread not found/,
  );
});

test("AppWorkspaceService rejects unsafe thread ids and oversized messages", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-"));
  const service = new AppWorkspaceService({
    workspacePath,
    async createAgentRuntime() {
      throw new Error("should not run");
    },
  });

  await assert.rejects(service.getThread("user-a", "../escape"), /Invalid thread id/);
  const created = await service.createThread("user-a");
  await assert.rejects(
    service.sendMessage("user-a", created.id, "x".repeat(50_001)),
    /50,000 characters/,
  );
});

test("AppWorkspaceService exposes stable error codes", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-"));
  const service = new AppWorkspaceService({ workspacePath });

  await assert.rejects(
    service.getThread("user-a", "../escape"),
    (error) => error instanceof AppWorkspaceError && error.code === "invalid_input",
  );
  await assert.rejects(
    service.getThread("user-a", "missing"),
    (error) => error instanceof AppWorkspaceError && error.code === "not_found",
  );
});

test("AppWorkspaceService publishes persisted changes even when the agent fails", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-"));
  const changes = [];
  const service = new AppWorkspaceService({
    workspacePath,
    onChange(change) {
      changes.push(change);
    },
    createAgentRuntime() {
      return {
        async handleThreadMessage() {
          throw new Error("provider unavailable");
        },
      };
    },
  });
  const created = await service.createThread("user-a");

  await assert.rejects(
    service.sendMessage("user-a", created.id, "Hello"),
    /provider unavailable/,
  );

  assert.deepEqual(changes.map((change) => change.type), [
    "thread.created",
    "thread.changed",
  ]);
});

test("AppWorkspaceService retries runtime creation after a startup failure", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-"));
  let attempts = 0;
  const service = new AppWorkspaceService({
    workspacePath,
    createAgentRuntime() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary startup failure");
      }
      return {
        async handleThreadMessage() {
          return { responded: false, answer: "" };
        },
      };
    },
  });
  const created = await service.createThread("user-a");

  await assert.rejects(
    service.sendMessage("user-a", created.id, "First"),
    /temporary startup failure/,
  );
  const result = await service.sendMessage("user-a", created.id, "Second");

  assert.equal(attempts, 2);
  assert.deepEqual(result, { responded: false, answer: "" });
});
