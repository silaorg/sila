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
      aiModel: "gpt-5.2",
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
    /channels\/telegram\/-10012345\/files\/2026\/11\/20\/report\.pdf/,
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
      aiModel: "gpt-5.2",
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
    /channels\/telegram\/chat-42\/files\/2026\/11\/20\/voice-note\.mp3/,
  );
  assert.match(forwarded.text, /\[Audio transcription\]\nthe transcribed text/);
  assert.equal(mockBot.sentMessages.length, 1);
  assert.deepEqual(mockBot.sentMessages[0], { chatId: "chat-42", text: "processed" });
});

async function createLandFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-telegram-channel-"));
  const landPath = path.join(root, "land");
  const channelPath = path.join(landPath, "channels", "telegram");
  const providersPath = path.join(landPath, "providers");

  await fs.mkdir(channelPath, { recursive: true });
  await fs.mkdir(providersPath, { recursive: true });
  await fs.writeFile(path.join(providersPath, "openai.json"), JSON.stringify({ apiKey: "sk-test" }), "utf8");
  return { root, landPath, channelPath };
}

function createMockBot() {
  /** @type {Map<string, (ctx: any) => Promise<void>>} */
  const handlers = new Map();
  const sentMessages = [];

  return {
    handlers,
    sentMessages,
    telegram: {
      async sendMessage(chatId, text) {
        sentMessages.push({ chatId, text });
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

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}
