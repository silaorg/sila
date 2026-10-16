import { describe, it } from "node:test";
import { deepEqual, equal, rejects } from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LangMessage } from "aiwrapper";
import { ThreadStore } from "../../src/thread-store.js";

describe("ThreadStore", () => {
  it("loads the latest compression checkpoint without altering display history", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-compression-"));
    const store = new ThreadStore();
    try {
      await store.appendMessages(threadDir, [new LangMessage("user", "first"), new LangMessage("assistant", "done")]);
      await store.appendEvent(threadDir, { type: "compression", summary: "First task done.", throughMessageCount: 2 });
      await store.appendEvent(threadDir, { type: "delivery", status: "sent" });
      await store.appendMessages(threadDir, [new LangMessage("user", "next")]);
      await store.appendEvent(threadDir, { type: "compression", summary: "Next task pending.", throughMessageCount: 3 });
      await store.appendEvent(threadDir, { type: "compression", summary: "Shorter summary for a smaller model.", throughMessageCount: 3 });
      const { messages, checkpoint } = await store.loadAgentHistory(threadDir);
      deepEqual(messages.map((message) => message.text), ["first", "done", "next"]);
      deepEqual(checkpoint, { summary: "Shorter summary for a smaller model.", throughMessageCount: 3 });
      equal((await store.loadMessages(threadDir)).length, 3);
    } finally {
      await fs.rm(threadDir, { recursive: true, force: true });
    }
  });

  it("rejects a checkpoint that covers unsaved messages", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-checkpoint-"));
    const store = new ThreadStore();
    try {
      await store.appendEvent(threadDir, { type: "compression", summary: "Cannot cover future messages.", throughMessageCount: 1 });
      await store.appendMessages(threadDir, [new LangMessage("user", "later")]);
      await rejects(store.loadAgentHistory(threadDir), /Invalid compression checkpoint/);
      equal((await store.loadMessages(threadDir)).length, 1);
    } finally {
      await fs.rm(threadDir, { recursive: true, force: true });
    }
  });

  it("appends and loads message events", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();
    const messages = [
      new LangMessage("user", [{ type: "text", text: "hello" }]),
      new LangMessage("assistant", [{ type: "text", text: "world" }], { openaiResponseId: "resp_1" }),
    ];

    await store.appendMessages(threadDir, messages);

    const loaded = await store.loadMessages(threadDir);
    equal(loaded.length, 2);
    equal(loaded[0].role, "user");
    equal(loaded[1].role, "assistant");
    equal(loaded[1].meta.openaiResponseId, "resp_1");
    deepEqual(loaded[0].items, [{ type: "text", text: "hello" }]);

    const events = await store.loadEvents(threadDir);
    equal(events.length, 2);
    equal(events[0].type, "message");
    equal(events[0].message.role, "user");
    equal(typeof events[0].id, "string");
    equal(typeof events[0].at, "string");
  });

  it("loads legacy messages.json and migrates it to append-only events", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();
    const legacyPath = path.join(threadDir, "messages.json");
    await fs.writeFile(
      legacyPath,
      `${JSON.stringify([{ role: "user", items: [{ type: "text", text: "legacy" }] }], null, 2)}\n`,
      "utf8",
    );

    const loaded = await store.loadMessages(threadDir);
    equal(loaded.length, 1);
    equal(loaded[0].items[0].text, "legacy");

    const jsonlRaw = await fs.readFile(path.join(threadDir, "messages.jsonl"), "utf8");
    const lines = jsonlRaw.trim().split("\n").map((line) => JSON.parse(line));
    equal(lines.length, 1);
    equal(lines[0].type, "message");
    equal(lines[0].message.items[0].text, "legacy");
  });

  it("preserves existing bytes and appends only new events", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();
    const historyPath = path.join(threadDir, "messages.jsonl");
    const existing = `${JSON.stringify({ role: "user", items: [{ type: "text", text: "old snapshot" }] })}\n`;
    await fs.writeFile(historyPath, existing, "utf8");

    await store.appendMessages(threadDir, [
      new LangMessage("assistant", [{ type: "text", text: "new event" }]),
    ]);

    const raw = await fs.readFile(historyPath, "utf8");
    equal(raw.startsWith(existing), true);
    const loaded = await store.loadMessages(threadDir);
    deepEqual(loaded.map((message) => message.text), ["old snapshot", "new event"]);
  });

  it("does not lose concurrent appends", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.appendEvent(threadDir, {
          type: "delivery",
          deliveryId: `delivery-${index}`,
          status: "pending",
        })),
    );

    const events = await store.loadEvents(threadDir);
    equal(events.length, 20);
    equal(new Set(events.map((event) => event.deliveryId)).size, 20);
  });

  it("rejects corrupted history instead of silently erasing it", async () => {
    const threadDir = await fs.mkdtemp(path.join(os.tmpdir(), "thread-store-"));
    const store = new ThreadStore();
    const historyPath = path.join(threadDir, "messages.jsonl");
    const corrupted = "{\"role\":\"user\",\"items\":[}\n";
    await fs.writeFile(historyPath, corrupted, "utf8");

    await rejects(store.loadMessages(threadDir), /Invalid messages\.jsonl/);
    equal(await fs.readFile(historyPath, "utf8"), corrupted);
  });
});
