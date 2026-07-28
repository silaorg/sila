import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { enqueueSerialTask } from "../src/serial-task-queue.js";
import {
  formatWorkingMessage,
  loadChannelInstructions,
  readOpenAiApiKey,
  sanitizeThreadId,
  saveThreadState,
  toAgentRelativePath,
} from "../src/channels/channel-utils.js";

test("sanitizeThreadId replaces unsupported characters", () => {
  assert.equal(sanitizeThreadId("chat:123/alpha beta"), "chat_123_alpha_beta");
});

test("readOpenAiApiKey loads from workspace .env", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const workspacePath = path.join(tempRoot, "workspace");
  const channelPath = path.join(workspacePath, "channels", "telegram");
  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(path.join(workspacePath, ".env"), "OPENAI_API_KEY=sk-env-file\n", "utf8");

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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const channelPath = path.join(tempRoot, "workspace", "channels", "telegram");
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

test("shared channel formatting helpers normalize progress and paths", () => {
  assert.equal(formatWorkingMessage(""), "🔄 Working...");
  assert.equal(formatWorkingMessage("step complete"), "🔄 Working...\n\nstep complete");
  assert.equal(toAgentRelativePath(path.join("tmp", "thread", "files", "x.txt"), path.join("tmp", "thread")), "files/x.txt");
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const threadDir = path.join(tempRoot, "thread");
  await fs.mkdir(threadDir, { recursive: true });

  await saveThreadState(threadDir, { responded: true, userId: "u1" });
  const raw = await fs.readFile(path.join(threadDir, "state.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, { responded: true, userId: "u1" });
});

test("loadChannelInstructions appends runtime path anchors", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const workspacePath = path.join(tempRoot, "workspace");
  const channelPath = path.join(workspacePath, "channels", "telegram");
  const threadPath = path.join(channelPath, "thread-1");
  await fs.mkdir(threadPath, { recursive: true });
  const expectedWorkspacePath = await fs.realpath(workspacePath);
  const expectedThreadPath = await fs.realpath(threadPath);

  const instructions = await loadChannelInstructions(workspacePath, "telegram", threadPath);
  assert.match(instructions, /<environment_runtime_paths>/);
  assert.match(instructions, new RegExp(escapeRegex(`Workspace root (absolute): ${expectedWorkspacePath}`)));
  assert.match(instructions, new RegExp(escapeRegex(`Current thread root (absolute): ${expectedThreadPath}`)));
  assert.match(instructions, /Source repo root \(absolute\): \[not set\]/);
});

test("loadChannelInstructions sets thread root to [not set] when omitted", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(path.join(workspacePath, "channels", "telegram"), { recursive: true });

  const instructions = await loadChannelInstructions(workspacePath, "telegram");
  assert.match(instructions, /Current thread root \(absolute\): \[not set\]/);
});

test("loadChannelInstructions detects source repo root from .git", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const repoPath = path.join(tempRoot, "repo");
  const workspacePath = path.join(repoPath, "workspace");
  const channelPath = path.join(workspacePath, "channels", "telegram");
  const threadPath = path.join(channelPath, "thread-1");
  await fs.mkdir(path.join(repoPath, ".git"), { recursive: true });
  await fs.mkdir(threadPath, { recursive: true });
  const expectedRepoPath = await fs.realpath(repoPath);

  const instructions = await loadChannelInstructions(workspacePath, "telegram", threadPath);
  assert.match(instructions, new RegExp(escapeRegex(`Source repo root (absolute): ${expectedRepoPath}`)));
  assert.match(instructions, /how-to-create-skills/);
});

test("loadChannelInstructions uses SOURCE_PATH override when set", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const workspacePath = path.join(tempRoot, "workspace");
  const channelPath = path.join(workspacePath, "channels", "telegram");
  const threadPath = path.join(channelPath, "thread-1");
  const sourcePath = path.join(tempRoot, "source");
  await fs.mkdir(threadPath, { recursive: true });
  await fs.mkdir(sourcePath, { recursive: true });
  const expectedSourcePath = await fs.realpath(sourcePath);

  const previous = process.env.SOURCE_PATH;
  process.env.SOURCE_PATH = sourcePath;
  try {
    const instructions = await loadChannelInstructions(workspacePath, "telegram", threadPath);
    assert.match(instructions, new RegExp(escapeRegex(`Source repo root (absolute): ${expectedSourcePath}`)));
  } finally {
    if (typeof previous === "string") {
      process.env.SOURCE_PATH = previous;
    } else {
      delete process.env.SOURCE_PATH;
    }
  }
});

test("loadChannelInstructions exports runtime paths into process env", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-channel-utils-"));
  const workspacePath = path.join(tempRoot, "workspace");
  const channelPath = path.join(workspacePath, "channels", "telegram");
  const threadPath = path.join(channelPath, "thread-1");
  const sourcePath = path.join(tempRoot, "source");
  await fs.mkdir(threadPath, { recursive: true });
  await fs.mkdir(sourcePath, { recursive: true });

  const previousWorkspacePath = process.env.WORKSPACE_PATH;
  const previousThreadPath = process.env.THREAD_PATH;
  const previousSourcePath = process.env.SOURCE_PATH;
  process.env.SOURCE_PATH = sourcePath;

  try {
    await loadChannelInstructions(workspacePath, "telegram", threadPath);
    assert.equal(process.env.WORKSPACE_PATH, await fs.realpath(workspacePath));
    assert.equal(process.env.THREAD_PATH, await fs.realpath(threadPath));
    assert.equal(process.env.SOURCE_PATH, await fs.realpath(sourcePath));
  } finally {
    if (typeof previousWorkspacePath === "string") {
      process.env.WORKSPACE_PATH = previousWorkspacePath;
    } else {
      delete process.env.WORKSPACE_PATH;
    }
    if (typeof previousThreadPath === "string") {
      process.env.THREAD_PATH = previousThreadPath;
    } else {
      delete process.env.THREAD_PATH;
    }
    if (typeof previousSourcePath === "string") {
      process.env.SOURCE_PATH = previousSourcePath;
    } else {
      delete process.env.SOURCE_PATH;
    }
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
