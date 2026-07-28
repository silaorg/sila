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
  assert.deepEqual(
    Object.keys(thread.messages[0]).sort(),
    ["at", "attachments", "id", "role", "text"],
  );
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

test("updating model settings restarts the cached agent runtime", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-"));
  let runtimeCreations = 0;
  let runtimeStops = 0;
  const service = new AppWorkspaceService({
    workspacePath,
    createAgentRuntime() {
      runtimeCreations += 1;
      return {
        async handleThreadMessage() {
          return { responded: false, answer: "" };
        },
        async stop() {
          runtimeStops += 1;
        },
      };
    },
  });
  const created = await service.createThread("user-a");

  await service.sendMessage("user-a", created.id, "Before settings");
  await service.updateModelSettings({
    provider: "openai",
    model: "gpt-5.4",
    apiKeys: { openai: "workspace-key" },
  });
  await service.sendMessage("user-a", created.id, "After settings");

  assert.equal(runtimeCreations, 2);
  assert.equal(runtimeStops, 1);
});

test("app files use scoped references for uploads, shared assets, and agent context", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-files-"));
  await fs.mkdir(path.join(workspacePath, "assets"), { recursive: true });
  await fs.writeFile(path.join(workspacePath, "assets", "brief.md"), "# Brief\n");
  const store = new ThreadStore();
  let runtimeInput;
  const service = new AppWorkspaceService({
    workspacePath,
    threadStore: store,
    createAgentRuntime() {
      return {
        async handleThreadMessage(input) {
          runtimeInput = input;
          await store.appendMessages(input.threadDir, [
            new LangMessage(
              "user",
              `<@${input.userId}>: ${input.text}`,
              {
                app: {
                  text: input.publicText,
                  attachments: input.attachments,
                },
              },
            ),
          ]);
          return { responded: false, answer: "" };
        },
      };
    },
  });
  const thread = await service.createThread("user-a");
  const [uploaded] = await service.uploadFiles("user-a", thread.id, [{
    name: "../notes?.txt",
    type: "image/png",
    data: new TextEncoder().encode("hello"),
  }]);

  assert.match(uploaded.reference, /^thread:files\/\d{4}\/\d{2}\/\d{2}\/notes_\.txt$/);
  assert.equal(uploaded.kind, "text");
  assert.equal(
    await fs.readFile(
      (await service.getFile("user-a", thread.id, uploaded.reference)).absolutePath,
      "utf8",
    ),
    "hello",
  );

  const listed = await service.listFiles("user-a", thread.id);
  assert.deepEqual(
    listed.map((file) => file.reference).sort(),
    ["thread:" + uploaded.path, "workspace:assets/brief.md"].sort(),
  );
  assert.deepEqual(
    (await service.listFiles("user-a", thread.id, "brief")).map((file) => file.name),
    ["brief.md"],
  );

  const [removable] = await service.uploadFiles("user-a", thread.id, [{
    name: "remove-me.txt",
    type: "text/plain",
    data: new TextEncoder().encode("temporary"),
  }]);
  await service.removeUploadedFile("user-a", thread.id, removable.reference);
  await assert.rejects(
    service.getFile("user-a", thread.id, removable.reference),
    (error) => error instanceof AppWorkspaceError && error.code === "not_found",
  );
  await assert.rejects(
    service.removeUploadedFile("user-a", thread.id, "workspace:assets/brief.md"),
    /Only thread uploads/,
  );

  await service.sendMessage("user-a", thread.id, {
    text: "Use [brief.md](<workspace:assets/brief.md>)",
    attachments: [uploaded.reference],
  });
  assert.equal(runtimeInput.publicText, "Use [brief.md](<workspace:assets/brief.md>)");
  assert.equal(runtimeInput.attachments[0].reference, uploaded.reference);
  assert.match(runtimeInput.text, /Attached "notes_\.txt": files\//);
  assert.match(runtimeInput.text, /Mentioned "brief\.md": .*assets\/brief\.md/);
  const sentMessage = (await service.getThread("user-a", thread.id)).messages[0];
  assert.equal(sentMessage.text, "Use [brief.md](<workspace:assets/brief.md>)");
  assert.equal(sentMessage.attachments[0].reference, uploaded.reference);
  await assert.rejects(
    service.removeUploadedFile("user-a", thread.id, uploaded.reference),
    /attached to a sent message/,
  );
});

test("sending and removing an attachment are serialized for each thread", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-files-"));
  const store = new ThreadStore();
  let enterRuntime;
  const runtimeEntered = new Promise((resolve) => {
    enterRuntime = resolve;
  });
  let releaseRuntime;
  const runtimeReleased = new Promise((resolve) => {
    releaseRuntime = resolve;
  });
  const service = new AppWorkspaceService({
    workspacePath,
    threadStore: store,
    createAgentRuntime() {
      return {
        async handleThreadMessage(input) {
          enterRuntime();
          await runtimeReleased;
          await store.appendMessages(input.threadDir, [
            new LangMessage("user", input.text, {
              app: {
                text: input.publicText,
                attachments: input.attachments,
              },
            }),
          ]);
          return { responded: false, answer: "" };
        },
      };
    },
  });
  const thread = await service.createThread("user-a");
  const [uploaded] = await service.uploadFiles("user-a", thread.id, [{
    name: "keep.txt",
    data: new TextEncoder().encode("keep"),
  }]);

  const send = service.sendMessage("user-a", thread.id, {
    text: "Keep this",
    attachments: [uploaded.reference],
  });
  await runtimeEntered;
  const remove = service.removeUploadedFile("user-a", thread.id, uploaded.reference);
  releaseRuntime();

  await send;
  await assert.rejects(remove, /attached to a sent message/);
  assert.equal(
    await fs.readFile(
      (await service.getFile("user-a", thread.id, uploaded.reference)).absolutePath,
      "utf8",
    ),
    "keep",
  );
});

test("app file references cannot escape their workspace or cross thread boundaries", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "app-workspace-files-"));
  const service = new AppWorkspaceService({ workspacePath });
  const first = await service.createThread("user-a");
  const second = await service.createThread("user-a");
  const [uploaded] = await service.uploadFiles("user-a", first.id, [{
    name: "private.txt",
    type: "text/plain",
    data: new TextEncoder().encode("private"),
  }]);

  await assert.rejects(
    service.getFile("user-a", first.id, "workspace:assets/../../secret.txt"),
    (error) => error instanceof AppWorkspaceError && error.code === "invalid_input",
  );
  await assert.rejects(
    service.getFile("user-a", second.id, uploaded.reference),
    (error) => error instanceof AppWorkspaceError && error.code === "not_found",
  );
});
