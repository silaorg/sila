import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ThreadStore } from "../src/agent-runtime/thread-store.js";
import { ThreadedChannelRuntime } from "../src/channels/threaded-channel-runtime.js";

test("ThreadedChannelRuntime records successful delivery lifecycle", async () => {
  const channelPath = await fs.mkdtemp(path.join(os.tmpdir(), "threaded-channel-"));
  const store = new ThreadStore();
  const runtime = new ThreadedChannelRuntime({
    channelPath,
    channelName: "test",
    threadStore: store,
    agentRuntime: {
      async handleThreadMessage() {
        return { responded: true, answer: "hello" };
      },
    },
  });

  await runtime.handleThreadMessage({
    thread: { threadId: "thread-1" },
    userId: "user-1",
    text: "hi",
    async sendReply() {},
  });

  const events = await store.loadEvents(path.join(channelPath, "thread-1"));
  const deliveries = events.filter((event) => event.type === "delivery");
  assert.deepEqual(deliveries.map((event) => event.status), ["pending", "sent"]);
  assert.equal(deliveries[0].deliveryId, deliveries[1].deliveryId);
  assert.equal(deliveries[0].channel, "test");
  assert.equal(deliveries[0].text, "hello");
});

test("ThreadedChannelRuntime records failed delivery before rethrowing", async () => {
  const channelPath = await fs.mkdtemp(path.join(os.tmpdir(), "threaded-channel-"));
  const store = new ThreadStore();
  const runtime = new ThreadedChannelRuntime({
    channelPath,
    channelName: "test",
    threadStore: store,
    agentRuntime: {
      async handleThreadMessage() {
        return { responded: true, answer: "hello" };
      },
    },
  });

  await assert.rejects(
    runtime.handleThreadMessage({
      thread: { threadId: "thread-1" },
      userId: "user-1",
      text: "hi",
      async sendReply() {
        throw new Error("provider unavailable");
      },
    }),
    /provider unavailable/,
  );

  const events = await store.loadEvents(path.join(channelPath, "thread-1"));
  const deliveries = events.filter((event) => event.type === "delivery");
  assert.deepEqual(deliveries.map((event) => event.status), ["pending", "failed"]);
  assert.equal(deliveries[1].error, "provider unavailable");
});

test("ThreadedChannelRuntime drains in-flight thread work before shutdown", async () => {
  const channelPath = await fs.mkdtemp(path.join(os.tmpdir(), "threaded-channel-"));
  const runtime = new ThreadedChannelRuntime({ channelPath });
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  let started = false;
  const task = runtime.enqueue("thread-1", async () => {
    started = true;
    await blocked;
  });

  while (!started) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  let drained = false;
  const draining = runtime.drain().then(() => {
    drained = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(drained, false);

  release();
  await Promise.all([task, draining]);
  assert.equal(drained, true);
});
