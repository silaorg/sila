import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SlackChannel } from "../src/channels/slack-channel.js";

test("slack runtime can upload files through send_slack_file callback", async () => {
  const { channelPath, landPath } = await createLandFixture();
  const mockApp = createMockSlackApp();
  let uploadResult = null;
  const sentFilePath = path.join(landPath, "assets", "report.txt");
  await fs.mkdir(path.dirname(sentFilePath), { recursive: true });
  await fs.writeFile(sentFilePath, "report", "utf8");

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            uploadResult = await input.sendSlackFile?.({
              path: sentFilePath,
              title: "Weekly report",
              comment: "Generated file",
            });
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "C111",
    user: "U123",
    text: "send report",
    thread_ts: "1710000000.123456",
  });
  await channel.stop();

  assert.equal(mockApp.uploadCalls.length, 1);
  assert.deepEqual(mockApp.uploadCalls[0], {
    channel_id: "C111",
    file: sentFilePath,
    filename: "report.txt",
    thread_ts: "1710000000.123456",
    title: "Weekly report",
    initial_comment: "Generated file",
  });
  assert.deepEqual(uploadResult, {
    fileId: "F123",
    permalink: "https://example.test/file/F123",
    fileIds: ["F123"],
    permalinks: ["https://example.test/file/F123"],
  });
  assert.equal(mockApp.postedMessages.length, 0);
});

test("slack runtime can upload multiple files in one message", async () => {
  const { channelPath, landPath } = await createLandFixture();
  const mockApp = createMockSlackApp();
  let uploadResult = null;
  const fileOnePath = path.join(landPath, "assets", "one.txt");
  const fileTwoPath = path.join(landPath, "assets", "two.txt");
  await fs.mkdir(path.dirname(fileOnePath), { recursive: true });
  await fs.writeFile(fileOnePath, "one", "utf8");
  await fs.writeFile(fileTwoPath, "two", "utf8");

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            uploadResult = await input.sendSlackFile?.({
              files: [
                { path: fileOnePath },
                { path: fileTwoPath, filename: "renamed-two.txt" },
              ],
              comment: "Generated files",
            });
            return { responded: false, answer: "" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "C222",
    user: "U123",
    text: "send all",
    thread_ts: "1710000000.888888",
  });
  await channel.stop();

  assert.equal(mockApp.uploadCalls.length, 1);
  assert.deepEqual(mockApp.uploadCalls[0], {
    channel_id: "C222",
    file_uploads: [
      { file: fileOnePath, filename: "one.txt" },
      { file: fileTwoPath, filename: "renamed-two.txt" },
    ],
    thread_ts: "1710000000.888888",
    initial_comment: "Generated files",
  });
  assert.deepEqual(uploadResult, {
    fileId: "F123",
    permalink: "https://example.test/file/F123",
    fileIds: ["F123", "F124"],
    permalinks: [
      "https://example.test/file/F123",
      "https://example.test/file/F124/download",
    ],
  });
});

test("slack runtime posts replies with mrkdwn enabled", async () => {
  const { channelPath } = await createLandFixture();
  const mockApp = createMockSlackApp();

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage() {
            return { responded: true, answer: "*bold* message" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "C333",
    user: "U123",
    text: "reply please",
    thread_ts: "1710000001.000001",
  });
  await channel.stop();

  assert.equal(mockApp.postedMessages.length, 1);
  assert.deepEqual(mockApp.postedMessages[0], {
    channel: "C333",
    text: "*bold* message",
    mrkdwn: true,
    thread_ts: "1710000001.000001",
  });
});

test("slack runtime posts intermediate assistant loop messages in thread", async () => {
  const { channelPath } = await createLandFixture();
  const mockApp = createMockSlackApp();

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage(input) {
            await input.onAssistantLoopMessage?.({
              text: "I am checking that now.",
              toolNames: ["execute_command"],
            });
            return { responded: true, answer: "done" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "C334",
    user: "U123",
    text: "run it",
    thread_ts: "1710000001.000002",
  });
  await channel.stop();

  assert.equal(mockApp.postedMessages.length, 2);
  assert.deepEqual(mockApp.postedMessages[0], {
    channel: "C334",
    text: "I am checking that now.",
    mrkdwn: true,
    thread_ts: "1710000001.000002",
  });
  assert.deepEqual(mockApp.postedMessages[1], {
    channel: "C334",
    text: "done",
    mrkdwn: true,
    thread_ts: "1710000001.000002",
  });
});

test("slack runtime keeps DM thread replies in the same thread", async () => {
  const { channelPath } = await createLandFixture();
  const mockApp = createMockSlackApp();

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage() {
            return { responded: true, answer: "dm thread reply" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "D444",
    channel_type: "im",
    user: "U123",
    text: "reply in dm thread",
    thread_ts: "1710000010.000001",
  });
  await channel.stop();

  assert.equal(mockApp.postedMessages.length, 1);
  assert.deepEqual(mockApp.postedMessages[0], {
    channel: "D444",
    text: "dm thread reply",
    mrkdwn: true,
    thread_ts: "1710000010.000001",
  });
});

test("slack runtime posts plain DM replies without thread_ts", async () => {
  const { channelPath } = await createLandFixture();
  const mockApp = createMockSlackApp();

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
      },
      createAgentRuntime() {
        return {
          async handleThreadMessage() {
            return { responded: true, answer: "dm main reply" };
          },
          async stop() {},
        };
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "D555",
    channel_type: "im",
    user: "U123",
    text: "reply in dm",
  });
  await channel.stop();

  assert.equal(mockApp.postedMessages.length, 1);
  assert.deepEqual(mockApp.postedMessages[0], {
    channel: "D555",
    text: "dm main reply",
    mrkdwn: true,
  });
});

test("slack file uploads are forwarded as relative dated paths", async () => {
  const { channelPath } = await createLandFixture();
  const mockApp = createMockSlackApp();
  const runtimeCalls = [];
  const storedFiles = [];

  const channel = new SlackChannel(
    channelPath,
    {
      channel: "slack",
      enabled: true,
      botUserOAuthToken: "xoxb-test",
      appLevelToken: "xapp-test",
    },
    {
      async createSlackApp() {
        return mockApp;
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
      async storeSlackFile(input) {
        storedFiles.push(input);
        return await writeFakeStoredFile(input.threadDir, input.createdAt, input.originalName);
      },
    },
  );

  await channel.run();
  await mockApp.emitMessage({
    channel: "C777",
    user: "U123",
    subtype: "file_share",
    ts: toSlackTimestamp(new Date("2026-11-20T09:30:00Z")),
    files: [
      {
        id: "F900",
        name: "report.pdf",
        mimetype: "application/pdf",
        url_private_download: "https://example.test/file/F900/download",
      },
    ],
  });
  await channel.stop();

  assert.equal(storedFiles.length, 1);
  assert.equal(storedFiles[0].fileUrl, "https://example.test/file/F900/download");
  assert.equal(runtimeCalls.length, 1);
  assert.match(runtimeCalls[0].text, /files\/2026\/11\/20\/report\.pdf/);
});

async function createLandFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-slack-channel-"));
  const landPath = path.join(root, "land");
  const channelPath = path.join(landPath, "channels", "slack");

  await fs.mkdir(channelPath, { recursive: true });
  await fs.writeFile(path.join(landPath, ".env"), "OPENAI_API_KEY=sk-test\n", "utf8");
  return { root, landPath, channelPath };
}

function createMockSlackApp() {
  /** @type {null | ((input: { message: any }) => Promise<void>)} */
  let messageHandler = null;
  const uploadCalls = [];
  const postedMessages = [];

  return {
    uploadCalls,
    postedMessages,
    client: {
      auth: {
        async test() {
          return { user_id: "U_BOT" };
        },
      },
      files: {
        async uploadV2(input) {
          uploadCalls.push(input);
          if (Array.isArray(input.file_uploads)) {
            return {
              files: [
                {
                  ok: true,
                  files: [
                    { id: "F123", permalink: "https://example.test/file/F123" },
                    { id: "F124", url_private_download: "https://example.test/file/F124/download" },
                  ],
                },
              ],
            };
          }
          return {
            files: [
              {
                ok: true,
                files: [{ id: "F123", permalink: "https://example.test/file/F123" }],
              },
            ],
          };
        },
      },
      chat: {
        async postMessage(input) {
          postedMessages.push(input);
        },
      },
    },
    message(handler) {
      messageHandler = handler;
    },
    async start() {},
    async stop() {},
    async emitMessage(message) {
      if (!messageHandler) {
        throw new Error("Missing Slack message handler");
      }
      await messageHandler({ message });
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

function toSlackTimestamp(date) {
  return `${Math.floor(date.getTime() / 1000)}.000001`;
}
