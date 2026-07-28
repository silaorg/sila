import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LangMessage } from "aiwrapper";
import { AppWorkspaceService } from "../src/app-workspace-service.js";
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
            new LangMessage("user", [{ type: "text", text: input.text }]),
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
