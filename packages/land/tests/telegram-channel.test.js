import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { TelegramChannel } from "../src/channels/telegram-channel.js";

test("telegram document upload is forwarded as relative dated path", async () => {
  const { channelPath } = await createLandFixture();
  const mockBot = createMockBot();
  const runtimeCalls = [];

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            runtimeCalls.push(input);
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "";
      },
    },
  );

  await channel.run();
  await mockBot.emit("document", {
    chat: { id: -10012345 },
    from: { id: 77, is_bot: false },
    message: {
      date: toUnixSeconds(new Date("2026-11-20T09:30:00Z")),
      document: { file_id: "doc-file-1", file_name: "report.pdf" },
      caption: "please review",
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(runtimeCalls.length, 1);
  const forwarded = runtimeCalls[0];
  assert.equal(forwarded.userId, "77");
  assert.match(
    forwarded.text,
    /files\/2026\/11\/20\/report\.pdf/,
  );
  assert.match(forwarded.text, /please review/);
});

test("telegram audio upload includes transcription and sends response", async () => {
  const { channelPath } = await createLandFixture();
  const mockBot = createMockBot();
  const runtimeCalls = [];

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            runtimeCalls.push(input);
            return { responded: true, answer: "processed" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "the transcribed text";
      },
    },
  );

  await channel.run();
  await mockBot.emit("audio", {
    chat: { id: "chat-42" },
    from: { id: 12, is_bot: false },
    message: {
      date: toUnixSeconds(new Date("2026-11-20T15:00:00Z")),
      audio: { file_id: "audio-file-1", file_name: "voice-note.mp3" },
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(runtimeCalls.length, 1);
  const forwarded = runtimeCalls[0];
  assert.match(
    forwarded.text,
    /files\/2026\/11\/20\/voice-note\.mp3/,
  );
  assert.match(forwarded.text, /\[Audio transcription\]\nthe transcribed text/);
  assert.equal(mockBot.sentMessages.length, 1);
  assert.deepEqual(mockBot.sentMessages[0], { chatId: "chat-42", text: "processed" });
});

test("telegram text reply includes replied message context", async () => {
  const { channelPath } = await createLandFixture();
  const mockBot = createMockBot();
  const runtimeCalls = [];

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            runtimeCalls.push(input);
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "";
      },
    },
  );

  await channel.run();
  await mockBot.emit("text", {
    chat: { id: "chat-reply-1" },
    from: { id: 78, is_bot: false },
    message: {
      text: "what should we do next?",
      date: toUnixSeconds(new Date("2026-11-20T16:05:00Z")),
      reply_to_message: {
        message_id: 44,
        text: "ship the fix in 10 minutes",
        from: { id: 91, username: "alice" },
      },
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(runtimeCalls.length, 1);
  const forwarded = runtimeCalls[0];
  assert.match(forwarded.text, /\[Reply context: #44 from @alice\]/);
  assert.match(forwarded.text, /ship the fix in 10 minutes/);
  assert.match(forwarded.text, /what should we do next\?/);
});

test("telegram external reply uses quote text instead of current message text", async () => {
  const { channelPath } = await createLandFixture();
  const mockBot = createMockBot();
  const runtimeCalls = [];

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            runtimeCalls.push(input);
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "";
      },
    },
  );

  await channel.run();
  await mockBot.emit("text", {
    chat: { id: "chat-external-reply-1" },
    from: { id: 101, is_bot: false },
    message: {
      text: "please answer this",
      date: toUnixSeconds(new Date("2026-11-20T16:10:00Z")),
      quote: {
        text: "status update from upstream",
        position: 0,
      },
      external_reply: {
        message_id: 88,
        origin: {
          type: "user",
          date: toUnixSeconds(new Date("2026-11-20T16:00:00Z")),
          sender_user: { id: 202, username: "upstream" },
        },
      },
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(runtimeCalls.length, 1);
  const forwarded = runtimeCalls[0];
  assert.match(forwarded.text, /\[Reply context: #88 from @upstream\]/);
  assert.match(forwarded.text, /status update from upstream/);
  assert.match(forwarded.text, /please answer this/);
});

test("telegram external reply keeps metadata when reply content is unavailable", async () => {
  const { channelPath } = await createLandFixture();
  const mockBot = createMockBot();
  const runtimeCalls = [];

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            runtimeCalls.push(input);
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "";
      },
    },
  );

  await channel.run();
  await mockBot.emit("text", {
    chat: { id: "chat-external-reply-2" },
    from: { id: 101, is_bot: false },
    message: {
      text: "follow up",
      date: toUnixSeconds(new Date("2026-11-20T16:12:00Z")),
      external_reply: {
        message_id: 89,
        origin: {
          type: "hidden_user",
          date: toUnixSeconds(new Date("2026-11-20T16:00:00Z")),
          sender_user_name: "Anonymous",
        },
      },
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(runtimeCalls.length, 1);
  const forwarded = runtimeCalls[0];
  assert.match(forwarded.text, /\[Reply context: #89 from Anonymous\]/);
  assert.match(forwarded.text, /follow up/);
});

test("telegram runtime can send files through send_telegram_file callback", async () => {
  const { channelPath, landPath } = await createLandFixture();
  const mockBot = createMockBot();
  const sentFilePath = path.join(landPath, "assets", "report.txt");
  await fs.mkdir(path.dirname(sentFilePath), { recursive: true });
  await fs.writeFile(sentFilePath, "report", "utf8");

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            await input.sendTelegramFile?.({
              path: sentFilePath,
              kind: "document",
              caption: "generated",
            });
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "";
      },
    },
  );

  await channel.run();
  await mockBot.emit("text", {
    chat: { id: "chat-send-1" },
    from: { id: 19, is_bot: false },
    message: {
      text: "send the report",
      date: toUnixSeconds(new Date("2026-11-20T16:00:00Z")),
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(mockBot.sentFiles.length, 1);
  assert.deepEqual(mockBot.sentFiles[0], {
    chatId: "chat-send-1",
    kind: "document",
    caption: "generated",
  });
});

test("telegram reloads skills into instructions on each message", async () => {
  const { channelPath, landPath } = await createLandFixture();
  const mockBot = createMockBot();
  const loadedInstructions = [];
  const skillFilePath = path.join(landPath, "skills", "dynamic-skill", "SKILL.md");
  await writeSkillFile(skillFilePath, "first description");

  const channel = new TelegramChannel(
    channelPath,
    {
      channel: "telegram",
      enabled: true,
      botToken: "test-bot-token",
    },
    {
      async createBot() {
        return mockBot;
      },
      createOpenAiClient() {
        return {};
      },
      createAgentRuntime(options) {
        assert.equal(typeof options.loadInstructions, "function");
        return {
          async handleThreadMessage() {
            loadedInstructions.push(await options.loadInstructions());
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
      async storeTelegramFile(input) {
        const targetPath = await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
        return targetPath;
      },
      async transcribeAudioFile() {
        return "";
      },
    },
  );

  await channel.run();
  await mockBot.emit("text", {
    chat: { id: "chat-skill-refresh" },
    from: { id: 55, is_bot: false },
    message: {
      text: "first message",
      date: toUnixSeconds(new Date("2026-11-20T18:00:00Z")),
    },
    telegram: mockBot.telegram,
  });

  await writeSkillFile(skillFilePath, "second description");

  await mockBot.emit("text", {
    chat: { id: "chat-skill-refresh" },
    from: { id: 55, is_bot: false },
    message: {
      text: "second message",
      date: toUnixSeconds(new Date("2026-11-20T18:05:00Z")),
    },
    telegram: mockBot.telegram,
  });
  await channel.stop();

  assert.equal(loadedInstructions.length, 2);
  assert.match(loadedInstructions[0], /dynamic-skill: first description/);
  assert.match(loadedInstructions[1], /dynamic-skill: second description/);
});

async function createLandFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-telegram-channel-"));
  const landPath = path.join(root, "land");
  const channelPath = path.join(landPath, "channels", "telegram");

  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(path.join(landPath, ".env"), "OPENAI_API_KEY=sk-test\n", "utf8");
  return { root, landPath, channelPath };
}

function createMockBot() {
  /** @type {Map<string, (ctx: any) => Promise<void>>} */
  const handlers = new Map();
  const sentMessages = [];
  const sentFiles = [];

  return {
    handlers,
    sentMessages,
    sentFiles,
    telegram: {
      async sendMessage(chatId, text) {
        sentMessages.push({ chatId, text });
      },
      async sendPhoto(chatId, _input, extra) {
        sentFiles.push({ chatId, kind: "photo", caption: extra?.caption });
        return { message_id: 1 };
      },
      async sendVideo(chatId, _input, extra) {
        sentFiles.push({ chatId, kind: "video", caption: extra?.caption });
        return { message_id: 2 };
      },
      async sendAudio(chatId, _input, extra) {
        sentFiles.push({ chatId, kind: "audio", caption: extra?.caption });
        return { message_id: 3 };
      },
      async sendVoice(chatId, _input, extra) {
        sentFiles.push({ chatId, kind: "voice", caption: extra?.caption });
        return { message_id: 4 };
      },
      async sendDocument(chatId, _input, extra) {
        sentFiles.push({ chatId, kind: "document", caption: extra?.caption });
        return { message_id: 5 };
      },
      async getFileLink(fileId) {
        return { href: `https://example.test/files/${fileId}` };
      },
      async getMe() {
        return { id: 999001, username: "test_bot" };
      },
    },
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    catch() {},
    async launch() {},
    stop() {},
    async emit(eventName, ctx) {
      const handler = handlers.get(eventName);
      if (!handler) {
        throw new Error(`Missing handler for ${eventName}`);
      }
      await handler(ctx);
    },
  };
}

async function writeFakeStoredFile(threadDir, createdAt, fileName) {
  const year = String(createdAt.getFullYear());
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getDate()).padStart(2, "0");
  const dirPath = path.join(threadDir, "files", year, month, day);
  await fs.mkdir(dirPath, { recursive: true });
  const fullPath = path.join(dirPath, fileName);
  await fs.writeFile(fullPath, "test\n", "utf8");
  return fullPath;
}

async function writeSkillFile(skillFilePath, description) {
  await fs.mkdir(path.dirname(skillFilePath), { recursive: true });
  await fs.writeFile(
    skillFilePath,
    `---
name: dynamic-skill
description: ${description}
---
# Dynamic skill
`,
    "utf8",
  );
}

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}
