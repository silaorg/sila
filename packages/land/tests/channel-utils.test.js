import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  enqueueSerialTask,
  readExaApiKey,
  readOpenAiApiKey,
  sanitizeThreadId,
  saveThreadState,
} from "../src/channels/channel-utils.js";

test("sanitizeThreadId replaces unsupported characters", () => {
  assert.equal(sanitizeThreadId("chat:123/alpha beta"), "chat_123_alpha_beta");
});

test("readOpenAiApiKey loads from land .env", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-channel-utils-"));
  const landPath = path.join(tempRoot, "land");
  const channelPath = path.join(landPath, "channels", "telegram");
  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(path.join(landPath, ".env"), "OPENAI_API_KEY=sk-env-file\n", "utf8");

  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const key = await readOpenAiApiKey(channelPath);
    assert.equal(key, "sk-env-file");
  } finally {
    if (typeof previous === "string") {
      process.env.OPENAI_API_KEY = previous;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});

test("readOpenAiApiKey falls back to env", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-channel-utils-"));
  const channelPath = path.join(tempRoot, "land", "channels", "telegram");
  await fs.mkdir(channelPath, { recursive: true });

  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-env";
  try {
    const key = await readOpenAiApiKey(channelPath);
    assert.equal(key, "sk-env");
  } finally {
    if (typeof previous === "string") {
      process.env.OPENAI_API_KEY = previous;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});

test("readExaApiKey loads from land .env", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-channel-utils-"));
  const landPath = path.join(tempRoot, "land");
  const channelPath = path.join(landPath, "channels", "telegram");
  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(path.join(landPath, ".env"), "EXA_API_KEY=exa-key\n", "utf8");

  const previous = process.env.EXA_API_KEY;
  delete process.env.EXA_API_KEY;
  try {
    const key = await readExaApiKey(channelPath);
    assert.equal(key, "exa-key");
  } finally {
    if (typeof previous === "string") {
      process.env.EXA_API_KEY = previous;
    } else {
      delete process.env.EXA_API_KEY;
    }
  }
});

test("enqueueSerialTask runs tasks in order per key", async () => {
  const queue = new Map();
  const events = [];

  const first = enqueueSerialTask(queue, "chat-1", async () => {
    events.push("first:start");
    await sleep(20);
    events.push("first:end");
  });
  const second = enqueueSerialTask(queue, "chat-1", async () => {
    events.push("second:start");
    events.push("second:end");
  });

  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("saveThreadState writes JSON state file", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-channel-utils-"));
  const threadDir = path.join(tempRoot, "thread");
  await fs.mkdir(threadDir, { recursive: true });

  await saveThreadState(threadDir, { responded: true, userId: "u1" });
  const raw = await fs.readFile(path.join(threadDir, "state.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, { responded: true, userId: "u1" });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
